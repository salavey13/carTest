#!/bin/bash
# task181: Выпуск №2 «Счётчик денег» — 5 новых AI-панелей (1344x768).
# Референс героя: founder-rustam.jpg (short dark hair, black sunglasses,
# bright pink t-shirt with black abstract print). Композиции с отрицательным
# пространством под баллоны (уроки task179/180: no text in image, no cars
# unless asked, single-subject scenes).
set -e
cd /home/z/cartest/public/comic-book

STYLE="comic book panel, bold ink outlines, halftone dot shading, neon cyberpunk lighting, cyan and magenta accents, dark moody night scene, cinematic composition, high quality, detailed illustration, no text, no letters, no words, no captions, no speech bubbles"
HERO="man in his early 30s with short dark hair and black sunglasses, wearing a bright pink t-shirt with a black abstract print"

# 01 Просто проверю — герой на диване, свет экрана; ЛЕВАЯ треть пустая (баллон)
z-ai image -p "$HERO, lying relaxed on a couch in a dark cozy apartment late at night, face and t-shirt lit by smartphone screen glow, smartphone held above him, TV static light in far background, character positioned on the right half of the frame, large empty dark wall in the left third of the frame, $STYLE" -o ep2-couch.png -s 1344x768

# 02 Подозрительно — герой с кружкой у кухонной стойки, телефон вибрирует; ПРАВАЯ треть пустая
z-ai image -p "$HERO, standing at a kitchen counter late at night holding a coffee mug, looking sideways with suspicious raised eyebrow over his sunglasses at a smartphone lying on the counter vibrating with motion lines, steam rising from mug, character on the left half of the frame, empty dark kitchen wall in the right third, $STYLE" -o ep2-coffee.png -s 1344x768

# 03 Кажется я понял — герой СО СПИНЫ смотрит на ряд байков (нет лица — нет риска)
z-ai image -p "$HERO seen from behind, hands on hips, standing in a dark motorcycle garage depot at night, looking at a row of futuristic electric motorcycles lined up under horizontal neon strip lights, bikes dominate the frame center and left, character back view on the right side, reflective workshop floor, $STYLE" -o ep2-garage.png -s 1344x768

# 04 Последняя проверка — герой откинулся, телефон экраном вниз на столе; телефон центр-лево
z-ai image -p "$HERO, leaning back in a chair with arms crossed and a satisfied smile, in a dark apartment at night, smartphone lying face down on a wooden table in the foreground center-left of the frame, neon window glow behind, character on the right half, $STYLE" -o ep2-phone-away.png -s 1344x768

# 05 Пасхалка — рука хватает светящийся телефон в темноте
z-ai image -p "extreme close-up of a man's hand grabbing a glowing smartphone in complete darkness, phone screen casting bright cyan light on the fingers, dramatic comic style, motion lines suggesting a sudden grab, dark background with faint magenta rim light, $STYLE" -o ep2-hand.png -s 1344x768

echo "DONE"; ls -la ep2-*.png
