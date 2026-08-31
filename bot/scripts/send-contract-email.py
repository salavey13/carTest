#!/usr/bin/env python3
"""
Отправка готового договора (.docx) на почту проката.
Usage: python3 scripts/send-contract-email.py <путь-к-docx> [тема]

Конфиг из корневого .env (или окружения):
  SMTP_HOST (дефолт smtp.mail.ru), SMTP_PORT (дефолт 465, SSL),
  SMTP_USER, SMTP_PASS, CONTRACT_EMAIL_TO (дефолт = SMTP_USER),
  CONTRACT_EMAIL_CC (копия оператору, дефолт djorudjov@bk.ru; пусто = без копии,
  несколько через запятую).

Если SMTP_PASS пуст — выходим с кодом 2 и понятным сообщением
(бот в этом случае пропускает шаг и говорит, что почта не настроена).
152-ФЗ: письмо содержит ПДн — слать только на служебный ящик проката.
"""
import os
import re
import smtplib
import sys
from email.message import EmailMessage
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z_]+)=(.*)$", line)
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2)


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: send-contract-email.py <file.docx> [subject]", file=sys.stderr)
        return 1

    load_env()
    host = os.environ.get("SMTP_HOST", "smtp.mail.ru")
    port = int(os.environ.get("SMTP_PORT", "465"))
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASS", "")
    to_addr = os.environ.get("CONTRACT_EMAIL_TO") or user

    # Два канала:
    #  1) auth: SMTP_USER+SMTP_PASS заданы → smtp.mail.ru:465 (надёжный, «от себя»).
    #  2) local: пароль не задан → локальный postfix (localhost:25, From bot@vip-bike.ru,
    #     DKIM-подпись opendkim). Проверено 2026-06-12: mail.ru принимает (250 OK).
    local_mode = not (user and password)
    if not to_addr:
        to_addr = "vip_bike@mail.ru"
    from_addr = user if not local_mode else os.environ.get("LOCAL_FROM", "bot@vip-bike.ru")

    # Копия договора оператору (152-ФЗ: служебный ящик проката). Дефолт переопределяется
    # env CONTRACT_EMAIL_CC (пустое значение = без копии). Несколько адресов — через запятую.
    cc_raw = os.environ.get("CONTRACT_EMAIL_CC", "djorudjov@bk.ru")
    cc_addrs = [a.strip() for a in cc_raw.split(",") if a.strip() and a.strip() != to_addr]
    recipients = [to_addr, *cc_addrs]

    file_path = Path(sys.argv[1])
    if not file_path.exists():
        print(f"файл не найден: {file_path}", file=sys.stderr)
        return 1

    # Тема — из env CONTRACT_SUBJECT (содержит ФИО, ПДн: не в argv, чтобы не светить в ps),
    # фолбэк на argv[2] (совместимость) либо имя файла.
    subject = os.environ.get("CONTRACT_SUBJECT") or (sys.argv[2] if len(sys.argv) > 2 else f"Договор {file_path.stem}")

    msg = EmailMessage()
    msg["From"] = f"VIP BIKE Bot <{from_addr}>"
    msg["To"] = to_addr
    if cc_addrs:
        msg["Cc"] = ", ".join(cc_addrs)
    msg["Subject"] = subject
    msg.set_content(f"Готовый договор во вложении: {file_path.name}\n\n— бот VIP BIKE")
    msg.add_attachment(
        file_path.read_bytes(),
        maintype="application",
        subtype="vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=file_path.name,
    )

    to_str = ", ".join(recipients)
    if local_mode:
        with smtplib.SMTP("localhost", 25, timeout=30) as smtp:
            smtp.send_message(msg, from_addr=from_addr, to_addrs=recipients)
        print(f"отправлено (локальный postfix): {file_path.name} -> {to_str}")
    else:
        with smtplib.SMTP_SSL(host, port, timeout=30) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg, to_addrs=recipients)
        print(f"отправлено: {file_path.name} -> {to_str}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
