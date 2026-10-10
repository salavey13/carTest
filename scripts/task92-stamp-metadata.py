#!/usr/bin/env python3
# Task 92: stamp page numbers (skip cover, body starts at 1) + PDF metadata
import io
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

SRC = '/home/z/cartest/task92-tutorial/vip-bike-kak-arendovat-2026-10.pdf'
W, H = 595.5, 842.25  # 794px x 1123px at 96dpi -> pt (x0.75)

reader = PdfReader(SRC)
writer = PdfWriter()
n = len(reader.pages)
for i, page in enumerate(reader.pages):
    if i == 0:
        writer.add_page(page)
        continue
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(float(page.mediabox.width), float(page.mediabox.height)))
    c.setFont('Helvetica', 8.5)
    c.setFillColor(HexColor('#8A8474'))
    c.drawCentredString(float(page.mediabox.width) / 2, 20, str(i))
    c.save()
    buf.seek(0)
    overlay = PdfReader(buf).pages[0]
    page.merge_page(overlay)
    writer.add_page(page)

writer.add_metadata({
    '/Title': 'Как арендовать мотоцикл через приложение — пошаговая инструкция',
    '/Author': 'VIP BIKE',
    '/Subject': 'Инструкция для райдера: выбор байка, даты, экипировка, корзина, договор и ПЭП, фото и одометр, активация аренды',
    '/Creator': 'Z.ai',
})
with open(SRC, 'wb') as f:
    writer.write(f)
print(f'stamped {n-1} of {n} pages + metadata OK')
