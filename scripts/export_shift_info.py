#!/usr/bin/env python3
"""
Export VIP Bike shift data for evening digests with salary calculation.

Generates a text report of:
- Active shifts (currently open, no clock_out_time)
- Completed shifts for today
- Salary calculation on the fly (hourly_rate × elapsed hours)

Usage:
  python3 export_shift_info.py [--date YYYY-MM-DD] [--format text|json]

Defaults to today's date, text format.
"""
import json, os, sys, urllib.request, datetime
from pathlib import Path

def _load_env():
    """Load SUPABASE_SERVICE_ROLE_KEY from <repo>/.env.local if not already set."""
    if os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        return
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

_load_env()

SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co"
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not SERVICE_KEY:
    raise SystemExit(
        "SUPABASE_SERVICE_ROLE_KEY не найден. Ожидается в <repo>/.env.local "
        "(SUPABASE_SERVICE_ROLE_KEY=...) или в env. НЕ хардкодь ключ в коде."
    )
VIP_BIKE_CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"

def supabase_get(path, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += f"?{params}"
    req = urllib.request.Request(url, headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def fetch_shifts(target_date):
    """Fetch all shifts for a crew on a specific date (completed + active)."""
    # Date range: start of day to end of day (UTC)
    date_start = f"{target_date}T00:00:00Z"
    date_end = f"{target_date}T23:59:59Z"

    # Get shifts that started on this date OR are still active (clock_out is NULL)
    # We fetch all shifts for the crew, then filter in Python
    shifts = supabase_get(
        "crew_member_shifts",
        f"crew_id=eq.{VIP_BIKE_CREW_ID}&select=id,member_id,clock_in_time,clock_out_time,hourly_rate,duration_minutes,salary_amount&order=clock_in_time.asc&limit=500"
    )
    return shifts

def fetch_members():
    """Fetch crew members for name lookup."""
    members = supabase_get(
        "crew_members",
        f"crew_id=eq.{VIP_BIKE_CREW_ID}&select=user_id,role,live_status"
    )
    # Fetch user data for usernames
    member_ids = [m["user_id"] for m in members]
    users = {}
    if member_ids:
        # Fetch individually (avoids URL encoding issues with `in.` filter)
        for mid in member_ids:
            try:
                user_data = supabase_get("users", f"id=eq.{mid}&select=id,username")
                for u in user_data:
                    users[u["id"]] = u
            except Exception:
                pass

    # Merge
    for m in members:
        u = users.get(m["user_id"], {})
        m["username"] = u.get("username", "unknown")

    return {m["user_id"]: m for m in members}

def calc_salary(shift):
    """Calculate salary on the fly for active or completed shifts."""
    rate = shift.get("hourly_rate") or 169

    if shift.get("salary_amount") is not None:
        return float(shift["salary_amount"])

    clock_in = shift.get("clock_in_time")
    clock_out = shift.get("clock_out_time")

    if not clock_in:
        return 0

    start = datetime.datetime.fromisoformat(clock_in.replace("Z", "+00:00"))

    if clock_out:
        end = datetime.datetime.fromisoformat(clock_out.replace("Z", "+00:00"))
    else:
        end = datetime.datetime.now(datetime.timezone.utc)

    duration_hours = (end - start).total_seconds() / 3600
    salary = duration_hours * rate
    return round(salary, 2)

def format_report(shifts, members, target_date):
    """Format shifts as text report for evening digest."""
    now = datetime.datetime.now(datetime.timezone.utc)

    # Split into active (no clock_out) and completed (has clock_out)
    active = [s for s in shifts if s.get("clock_out_time") is None]
    completed = [s for s in shifts if s.get("clock_out_time") is not None]

    # Filter completed to today only
    today_completed = []
    for s in completed:
        clock_in = s.get("clock_in_time", "")
        if clock_in.startswith(target_date):
            today_completed.append(s)

    # Also include active shifts that started today
    today_active = [s for s in active if s.get("clock_in_time", "").startswith(target_date)]

    lines = []
    lines.append(f"📊 Смены экипажа VIP_BIKE за {target_date}")
    lines.append(f"⏰ Отчёт сформирован: {now.strftime('%H:%M UTC')}")
    lines.append("")

    # Summary
    total_earnings = sum(calc_salary(s) for s in today_completed + today_active)
    total_hours_completed = sum((s.get("duration_minutes") or 0) / 60 for s in today_completed)
    total_hours_active = sum(
        (now - datetime.datetime.fromisoformat(s["clock_in_time"].replace("Z", "+00:00"))).total_seconds() / 3600
        for s in today_active
    )

    lines.append(f"📈 Итого за день:")
    lines.append(f"  • Завершённых смен: {len(today_completed)}")
    lines.append(f"  • Активных смен: {len(today_active)}")
    lines.append(f"  • Отработано часов: {total_hours_completed:.1f}ч (завершено) + {total_hours_active:.1f}ч (активно)")
    lines.append(f"  • Заработано: {total_earnings:.0f}₽ (по ставке 169₽/час)")
    lines.append("")

    # Active shifts
    if today_active:
        lines.append("🟢 АКТИВНЫЕ СМЕНЫ:")
        for s in today_active:
            member = members.get(s["member_id"], {})
            username = member.get("username", "unknown")
            role = member.get("role", "")
            rate = s.get("hourly_rate") or 169
            salary = calc_salary(s)
            start_time = datetime.datetime.fromisoformat(s["clock_in_time"].replace("Z", "+00:00"))
            elapsed = (now - start_time).total_seconds() / 3600
            lines.append(f"  • {username} ({role}) — начало {start_time.strftime('%H:%M')}, длительность {elapsed:.1f}ч, ставка {rate}₽/ч, заработано {salary:.0f}₽")
        lines.append("")

    # Completed shifts
    if today_completed:
        lines.append("✅ ЗАВЕРШЁННЫЕ СМЕНЫ:")
        for s in today_completed:
            member = members.get(s["member_id"], {})
            username = member.get("username", "unknown")
            rate = s.get("hourly_rate") or 169
            salary = calc_salary(s)
            start_time = datetime.datetime.fromisoformat(s["clock_in_time"].replace("Z", "+00:00"))
            end_time = datetime.datetime.fromisoformat(s["clock_out_time"].replace("Z", "+00:00"))
            duration = (end_time - start_time).total_seconds() / 3600
            lines.append(f"  • {username} — {start_time.strftime('%H:%M')}–{end_time.strftime('%H:%M')} ({duration:.1f}ч), ставка {rate}₽/ч, заработано {salary:.0f}₽")
        lines.append("")

    if not today_completed and not today_active:
        lines.append("😴 Сегодня смен не было.")
        lines.append("")

    # Live status summary
    online_members = [m for m in members.values() if m.get("live_status") == "online"]
    riding_members = [m for m in members.values() if m.get("live_status") == "riding"]
    offline_members = [m for m in members.values() if m.get("live_status") == "offline"]

    lines.append("👥 СТАТУС ЭКИПАЖА:")
    if online_members:
        lines.append(f"  🟢 Онлайн: {', '.join(m.get('username','?') for m in online_members)}")
    if riding_members:
        lines.append(f"  🏍️ На байке: {', '.join(m.get('username','?') for m in riding_members)}")
    lines.append(f"  ⚫ Оффлайн: {len(offline_members)} участников")
    lines.append("")

    return "\n".join(lines)


def main():
    # Parse args
    target_date = datetime.date.today().isoformat()
    fmt = "text"

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--date" and i + 1 < len(args):
            target_date = args[i + 1]
            i += 2
        elif args[i] == "--format" and i + 1 < len(args):
            fmt = args[i + 1]
            i += 2
        else:
            i += 1

    print(f"=== Fetching shift data for {target_date} ===\n", file=sys.stderr)

    shifts = fetch_shifts(target_date)
    members = fetch_members()

    print(f"Fetched {len(shifts)} shifts, {len(members)} members", file=sys.stderr)

    if fmt == "json":
        # JSON output
        active = [s for s in shifts if s.get("clock_out_time") is None]
        output = {
            "date": target_date,
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "active_shifts": len(active),
            "completed_shifts_today": len([s for s in shifts if s.get("clock_out_time") and s.get("clock_in_time", "").startswith(target_date)]),
            "shifts": shifts,
            "members": list(members.values()),
        }
        print(json.dumps(output, ensure_ascii=False, indent=2, default=str))
    else:
        # Text output
        report = format_report(shifts, members, target_date)
        print(report)

    return 0


if __name__ == "__main__":
    sys.exit(main())
