#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""task144d: final HTML patch — May/July deduced prices + 3 July verifications."""
import json, re

HTML = "/home/z/my-project/download/season-2026-report.html"
DATA = json.load(open("/home/z/my-project/scripts/task144-report-data.json"))

fleet_lines = "  fleet: [\n" + ",\n".join(
    f'    {{ name: {json.dumps(f["name"], ensure_ascii=False)}, revenue: {f["revenue"]}, deals: {f["deals"]}, days: {f["days"]} }}'
    for f in DATA["fleet"]) + "\n  ],"

s = open(HTML, encoding="utf-8").read()

def sub1(old, new):
    global s
    assert s.count(old) == 1, f"anchor not unique/found: {old[:90]!r} (count={s.count(old)})"
    s = s.replace(old, new)

sub1('{ key: "Май", revenue: 75000, deals: 15 }', '{ key: "Май", revenue: 101000, deals: 15 }')
sub1('{ key: "Июль", revenue: 562641, deals: 48 }', '{ key: "Июль", revenue: 582641, deals: 48 }')
sub1("revenueTotal: 2329932,", "revenueTotal: 2375932,")
sub1("operatorDeals: { count: 180, revenue: 1792991 },", "operatorDeals: { count: 180, revenue: 1838991 },")
sub1("verifications: { total: 230, verified: 102, commissionPool: 239600, retroPool: 78170 },",
     "verifications: { total: 233, verified: 105, commissionPool: 242610, retroPool: 81180 },")
sub1('hint: "канон из rental_verifications — 239 600 ₽ пула (ретро 78 170); выплачено — проставь", value: 239600, computed: true',
     'hint: "канон из rental_verifications — 242 610 ₽ пула (ретро 81 180); выплачено — проставь", value: 242610, computed: true')
sub1("источники: rentals (374 строки), service-работы (74), rental_verifications (230),",
     "источники: rentals (374 строки), service-работы (74), rental_verifications (233),")
s = re.sub(r"  fleet: \[.*?\n  \],", fleet_lines.replace("\\", "\\\\"), s, count=1, flags=re.S)

open(HTML, "w", encoding="utf-8").write(s)
for pat in ["101000", "582641", "2375932", "242610", "81180", "1838991"]:
    print(f"  contains {pat!r}:", pat in s)
