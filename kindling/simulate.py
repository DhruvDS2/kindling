"""Simulate one school year of product usage for a K-12 AI tutoring product.

Writes a DuckDB file with:
  calendar  - every day, its kind, and a running count of instructional days
  schools   - what the GTM team can see about each account
  teachers  - users, with role and join date
  events    - Segment-style usage events, aggregated per user per day
  truth     - the hidden outcome for every school (the engine never reads this)

Each school gets a hidden archetype that drives its behaviour. Decoy archetypes
look promising (or worrying) on a naive read but are not, which is what makes
the backtest meaningful.

Run:  python -m kindling.simulate
"""
from __future__ import annotations

from datetime import date, timedelta

import duckdb
import numpy as np
import pandas as pd

from kindling import config as C

KIND_MULT = {"instructional": 1.0, "weekend": 0.08, "break": 0.04, "summer": 0.02}

FREE_MIX = {"converter": 28, "stalled": 10, "solo_star": 24, "builders": 20, "dormant": 38}
PAID_MIX = {"healthy": 34, "expander": 12, "churner": 22, "healthy_break_renewal": 12}

RENEWALS_ANY = [date(2026, m, 1) for m in (2, 3, 4, 5, 6, 7)] + [date(2026, 1, 15)]
RENEWALS_AFTER_BREAK = [date(2026, 1, 15), date(2026, 2, 1), date(2026, 4, 1)]

FIRST = ["Larkspur", "Juniper", "Thistle", "Wrenfield", "Alder", "Quillon", "Marrow",
         "Kestrel", "Bramble", "Sorrel", "Halcyon", "Tamsin", "Vetch", "Corrigan",
         "Ashgrove", "Pellam", "Rookwood", "Sedgely", "Ivyhall", "Fennick"]
SECOND = ["Hollow", "Bluff", "Crossing", "Glen", "Reach", "Point", "Commons", "Vale",
          "Landing", "Heights"]
SUFFIX = ["Academy", "Prep", "Day School", "Country Day", "School"]
REGIONS = ["Northeast", "Southeast", "Midwest", "Southwest", "West"]

CITIES_BY_REGION = {
    "Northeast": [("Boston","MA"),("Providence","RI"),("Hartford","CT"),
                  ("Albany","NY"),("Burlington","VT"),("Portland","ME"),
                  ("Manchester","NH"),("Trenton","NJ"),("Philadelphia","PA"),
                  ("Concord","NH"),("Springfield","MA"),("New Haven","CT")],
    "Southeast": [("Atlanta","GA"),("Charlotte","NC"),("Nashville","TN"),
                  ("Richmond","VA"),("Columbia","SC"),("Birmingham","AL"),
                  ("Jackson","MS"),("Baton Rouge","LA"),("Tallahassee","FL"),
                  ("Raleigh","NC"),("Memphis","TN"),("Savannah","GA")],
    "Midwest":   [("Columbus","OH"),("Indianapolis","IN"),("Chicago","IL"),
                  ("Detroit","MI"),("Minneapolis","MN"),("Milwaukee","WI"),
                  ("Des Moines","IA"),("Kansas City","MO"),("Cleveland","OH"),
                  ("Cincinnati","OH"),("St. Louis","MO"),("Madison","WI")],
    "Southwest": [("Houston","TX"),("Phoenix","AZ"),("Dallas","TX"),
                  ("Albuquerque","NM"),("Denver","CO"),("Oklahoma City","OK"),
                  ("Austin","TX"),("Tucson","AZ"),("El Paso","TX"),
                  ("Santa Fe","NM"),("Fort Worth","TX"),("Colorado Springs","CO")],
    "West":      [("Los Angeles","CA"),("Seattle","WA"),("Portland","OR"),
                  ("Sacramento","CA"),("Las Vegas","NV"),("Boise","ID"),
                  ("San Francisco","CA"),("Oakland","CA"),("Spokane","WA"),
                  ("Eugene","OR"),("Salt Lake City","UT"),("Fresno","CA")],
}

DISTRICT_SUFFIXES = [
    "Unified School District", "Independent School District",
    "Public Schools", "City Schools", "County Schools",
]

CONTACT_FIRST = [
    "Sarah", "Jennifer", "Michael", "David", "Emily", "Jessica",
    "Matthew", "Ashley", "Christopher", "Amanda", "Daniel", "Lisa",
    "Andrew", "Michelle", "Kevin", "Laura", "Brian", "Karen",
    "James", "Nancy", "Robert", "Patricia", "Thomas", "Sandra",
    "Charles", "Margaret", "Joseph", "Barbara", "Richard", "Susan",
]
CONTACT_LAST = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia",
    "Miller", "Davis", "Wilson", "Moore", "Taylor", "Anderson",
    "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson",
    "Young", "Robinson", "Clark", "Lewis", "Lee", "Walker",
    "Hall", "Allen", "Wright", "Scott", "Green", "Baker",
]
CONTACT_TITLES = [
    "Principal", "Principal", "Principal",
    "Curriculum Director", "Technology Coordinator",
    "Director of Instruction",
]


class World:
    def __init__(self, seed: int = C.SEED):
        self.rng = np.random.default_rng(seed)
        self.days = list(C.all_days())
        self.day_index = {d: i for i, d in enumerate(self.days)}
        kinds = [C.day_kind(d) for d in self.days]
        self.kind_mult = np.array([KIND_MULT[k] for k in kinds])
        self.calendar = pd.DataFrame({"day": self.days, "kind": kinds})
        self.calendar["instr_idx"] = (self.calendar["kind"] == "instructional").cumsum()
        self.schools, self.teachers, self.events, self.truth = [], [], [], []
        self.names = self._unique_names()

    # ---------- helpers ----------
    def _unique_names(self):
        combos = [f"{a} {b} {c}" for a in FIRST for b in SECOND for c in SUFFIX]
        self.rng.shuffle(combos)
        return iter(combos)

    def rand_day(self, lo: date, hi: date) -> date:
        return lo + timedelta(days=int(self.rng.integers(0, (hi - lo).days + 1)))

    def idx(self, d: date) -> int:
        return self.day_index[min(max(d, C.START), C.END)]

    def add_teacher(self, school_id, joined: date, role="teacher") -> str:
        tid = f"t{len(self.teachers) + 1:05d}"
        self.teachers.append({"teacher_id": tid, "school_id": school_id, "role": role,
                              "joined_on": joined})
        ev = "admin_signed_up" if role == "admin" else "teacher_signed_up"
        self.events.append((joined, school_id, tid, ev, 1))
        return tid

    def simulate_usage(self, school_id, tid, joined: date, p_active, tutor_rate,
                       session_rate, intensity=None, stop: date | None = None):
        """Generate daily events for one teacher.

        intensity: optional array over all days multiplying p_active (ramps, decays).
        """
        n = len(self.days)
        alive = np.zeros(n)
        alive[self.idx(joined):] = 1.0
        if stop is not None and stop <= C.END:
            alive[self.idx(stop):] = 0.0
        p = p_active * self.kind_mult * alive
        if intensity is not None:
            p = p * intensity
        active = self.rng.random(n) < np.clip(p, 0, 1)
        tutors = self.rng.poisson(tutor_rate, n) * active
        sessions = self.rng.poisson(session_rate, n) * active
        for i in np.flatnonzero(active):
            d = self.days[i]
            self.events.append((d, school_id, tid, "teacher_active", 1))
            if tutors[i]:
                self.events.append((d, school_id, tid, "tutor_created", int(tutors[i])))
            if sessions[i]:
                self.events.append((d, school_id, tid, "student_session", int(sessions[i])))

    def ramp(self, start: date, days: int, lo=0.4):
        """Intensity that ramps from lo to 1.0 over `days` after start."""
        n = len(self.days)
        x = np.arange(n) - self.idx(start)
        return np.clip(lo + (1 - lo) * x / max(days, 1), lo, 1.0)

    def decay(self, start: date, half_life: float):
        n = len(self.days)
        x = np.maximum(np.arange(n) - self.idx(start), 0)
        return 0.5 ** (x / half_life)

    def new_school(self, plan: str, archetype: str, signup: date, seats=0,
                   renewal: date | None = None):
        sid = f"s{len(self.schools) + 1:03d}"
        typ = "independent" if self.rng.random() < 0.8 else "district"
        region = REGIONS[int(self.rng.integers(len(REGIONS)))]
        city, state = CITIES_BY_REGION[region][int(self.rng.integers(len(CITIES_BY_REGION[region])))]
        school_name = next(self.names)

        district: str | None = None
        if typ == "district":
            ds = DISTRICT_SUFFIXES[int(self.rng.integers(len(DISTRICT_SUFFIXES)))]
            district = f"{city} {ds}"

        first = CONTACT_FIRST[int(self.rng.integers(len(CONTACT_FIRST)))]
        last  = CONTACT_LAST[int(self.rng.integers(len(CONTACT_LAST)))]
        contact_name  = f"{first} {last}"
        contact_title = CONTACT_TITLES[int(self.rng.integers(len(CONTACT_TITLES)))]
        slug          = school_name.lower().replace(" ", "-")
        contact_email = f"{first.lower()}.{last.lower()}@{slug}.edu"

        self.schools.append({
            "school_id": sid, "name": school_name, "type": typ,
            "students": int(self.rng.integers(150, 1600)),
            "region": region, "city": city, "state": state,
            "district": district,
            "contact_name": contact_name, "contact_title": contact_title,
            "contact_email": contact_email,
            "plan_at_start": plan, "seats": seats,
            "arr": seats * C.PRICE_PER_SEAT, "signup_date": signup,
            "renewal_date": renewal,
        })
        self.truth.append({"school_id": sid, "archetype": archetype,
                           "converts_on": None, "renews": None, "churns_on": None,
                           "expands": False})
        return sid

    # ---------- free schools ----------
    def free_converter(self, archetype="converter"):
        """Converters spread from a champion to colleagues and buy.

        archetype="stalled" behaves the same way but never buys (budget freeze,
        leadership change): the realistic false positive no usage score can avoid.
        A quarter of converters are "quiet": fewer teachers, lighter use.
        """
        s0 = self.rand_day(date(2025, 8, 20), date(2026, 1, 20))
        sid = self.new_school("free", archetype, s0)
        quiet = self.rng.random() < 0.25
        champ = self.add_teacher(sid, s0)
        self.simulate_usage(sid, champ, s0, 0.75, 0.6, 4.0 if quiet else 6.0, self.ramp(s0, 21))
        k = 1 if quiet else int(self.rng.integers(2, 6))
        joins = sorted(s0 + timedelta(days=int(x)) for x in self.rng.integers(14, 70, k))
        for j in joins:
            t = self.add_teacher(sid, j)
            self.simulate_usage(sid, t, j, float(self.rng.uniform(0.45, 0.7)), 0.5,
                                float(self.rng.uniform(2, 4) if quiet else self.rng.uniform(3, 7)),
                                self.ramp(j, 14))
        second_colleague = joins[min(1, k - 1)]
        if self.rng.random() < 0.8:
            admin_day = second_colleague + timedelta(days=int(self.rng.integers(7, 22)))
            a = self.add_teacher(sid, admin_day, role="admin")
            self.simulate_usage(sid, a, admin_day, 0.15, 0.0, 0.0)
            base = admin_day
        else:
            base = second_colleague + timedelta(days=21)
        if archetype == "converter":
            self._convert(sid, base + timedelta(days=int(self.rng.integers(14, 46))))

    def free_solo_star(self):
        s0 = self.rand_day(date(2025, 8, 20), date(2026, 2, 15))
        sid = self.new_school("free", "solo_star", s0)
        t = self.add_teacher(sid, s0)
        self.simulate_usage(sid, t, s0, 0.75, 0.7, float(self.rng.uniform(6, 10)),
                            self.ramp(s0, 14))
        if self.rng.random() < 0.5:
            j = s0 + timedelta(days=int(self.rng.integers(10, 60)))
            t2 = self.add_teacher(sid, j)
            self.simulate_usage(sid, t2, j, 0.2, 0.3, 1.0, self.decay(j, 10))
        if self.rng.random() < 0.10:  # some small schools buy a seat anyway
            self._convert(sid, s0 + timedelta(days=int(self.rng.integers(40, 120))))

    def free_builders(self):
        s0 = self.rand_day(date(2025, 8, 20), date(2026, 2, 15))
        sid = self.new_school("free", "builders", s0)
        for _ in range(int(self.rng.integers(3, 7))):
            j = s0 + timedelta(days=int(self.rng.integers(0, 40)))
            t = self.add_teacher(sid, j)
            # lots of tutors built, students barely use them
            self.simulate_usage(sid, t, j, float(self.rng.uniform(0.4, 0.65)),
                                float(self.rng.uniform(1.0, 2.5)),
                                float(self.rng.uniform(0.2, 0.9)))
        if self.rng.random() < 0.05:
            self._convert(sid, s0 + timedelta(days=int(self.rng.integers(60, 150))))

    def free_dormant(self):
        s0 = self.rand_day(date(2025, 8, 20), date(2026, 4, 1))
        sid = self.new_school("free", "dormant", s0)
        for _ in range(int(self.rng.integers(1, 3))):
            j = s0 + timedelta(days=int(self.rng.integers(0, 10)))
            t = self.add_teacher(sid, j)
            self.simulate_usage(sid, t, j, 0.6, 0.8, 2.0, self.decay(j, 6))

    def _convert(self, sid, d: date):
        if d > C.END:
            return
        self.truth[-1]["converts_on"] = d
        self.events.append((d, sid, None, "plan_converted", 1))

    # ---------- paid schools ----------
    def paid(self, archetype: str):
        pool = RENEWALS_AFTER_BREAK if archetype == "healthy_break_renewal" else RENEWALS_ANY
        renewal = pool[int(self.rng.integers(len(pool)))]
        seats = int(self.rng.integers(6, 31))
        sid = self.new_school("paid", archetype, C.START, seats=seats, renewal=renewal)
        active_share = self.rng.uniform(0.6, 0.9) if archetype != "expander" else 0.6
        n_active = max(2, round(seats * active_share))
        a = self.add_teacher(sid, C.START, role="admin")
        self.simulate_usage(sid, a, C.START, 0.1, 0.0, 0.0)

        stops = [None] * n_active
        if archetype == "churner":
            decline = renewal - timedelta(days=int(self.rng.integers(70, 141)))
            spread = int(self.rng.integers(30, 61))
            keep = max(1, round(n_active * self.rng.uniform(0.0, 0.25)))
            for i in range(n_active - keep):
                stops[i] = decline + timedelta(days=int(self.rng.integers(0, spread)))
            self.truth[-1]["churns_on"] = renewal

        for stop in stops:
            j = self.rand_day(C.START, date(2025, 9, 15))
            t = self.add_teacher(sid, j)
            self.simulate_usage(sid, t, j, float(self.rng.uniform(0.5, 0.75)), 0.3,
                                float(self.rng.uniform(3, 6)), stop=stop)

        if archetype == "expander":
            extra = round(seats * self.rng.uniform(0.3, 0.8))
            for _ in range(extra):
                j = self.rand_day(date(2025, 9, 15), renewal - timedelta(days=20))
                t = self.add_teacher(sid, j)
                self.simulate_usage(sid, t, j, float(self.rng.uniform(0.5, 0.75)), 0.4,
                                    float(self.rng.uniform(3, 6)), self.ramp(j, 14))
            self.truth[-1]["expands"] = True

        churned = archetype == "churner"
        self.truth[-1]["renews"] = not churned
        ev = "plan_churned" if churned else ("plan_expanded" if archetype == "expander"
                                             else "plan_renewed")
        self.events.append((renewal, sid, None, ev, 1))

    # ---------- build ----------
    def build(self):
        makers = {"converter": self.free_converter,
                  "stalled": lambda: self.free_converter("stalled"),
                  "solo_star": self.free_solo_star,
                  "builders": self.free_builders, "dormant": self.free_dormant}
        plan = [k for k, n in FREE_MIX.items() for _ in range(n)]
        plan += [k for k, n in PAID_MIX.items() for _ in range(n)]
        self.rng.shuffle(plan)
        for arche in plan:
            makers[arche]() if arche in makers else self.paid(arche)
        return self

    def frames(self):
        ev = pd.DataFrame(self.events, columns=["day", "school_id", "teacher_id", "event", "n"])
        ev = ev[(ev["day"] >= C.START) & (ev["day"] <= C.END)]
        return {
            "calendar": self.calendar,
            "schools": pd.DataFrame(self.schools),
            "teachers": pd.DataFrame(self.teachers),
            "events": ev.sort_values(["day", "school_id"]).reset_index(drop=True),
            "truth": pd.DataFrame(self.truth),
        }


def write(frames: dict, path=C.DB_PATH):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    con = duckdb.connect(str(path))
    for name, df in frames.items():
        con.register("df", df)
        con.execute(f"CREATE TABLE {name} AS SELECT * FROM df")
        con.unregister("df")
    for col in ("day",):
        con.execute(f"ALTER TABLE calendar ALTER {col} TYPE DATE")
        con.execute(f"ALTER TABLE events ALTER {col} TYPE DATE")
    con.close()


def main():
    frames = World().build().frames()
    write(frames)
    t = frames["truth"]
    print(f"Wrote {C.DB_PATH.relative_to(C.ROOT)}")
    print(f"  schools  {len(frames['schools']):>7,}")
    print(f"  teachers {len(frames['teachers']):>7,}")
    print(f"  events   {len(frames['events']):>7,}")
    print("\nHidden archetypes:")
    print(t["archetype"].value_counts().to_string())
    print(f"\nFree schools that convert: {t['converts_on'].notna().sum()}")
    print(f"Paid schools that churn:   {t['churns_on'].notna().sum()}")


if __name__ == "__main__":
    main()
