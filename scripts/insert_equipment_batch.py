#!/usr/bin/env python3
"""
Insert equipment items from PDF inventory into Supabase public.cars.

Ditches the 7 old seed items and inserts 21 new items from the PDF:
- 20 jackets (13 textile, 5 leather, 1 combo)
- 1 pants (leather)

All items: type=equipment, crew_id=vip-bike, no images (to be added via admin).
"""
import json, urllib.request, os

SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM"
VIP_BIKE_CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
OWNER_ID = "356282674"  # I_O_S_NN (crew owner)

# Equipment items from PDF — 21 total
ITEMS = [
    # 1. TCM (Speed Level) — textile jacket, L, black
    {
        "id": "equip-jacket-tcm-speed-level",
        "make": "TCM",
        "model": "Speed Level",
        "description": "Текстильная мотокуртка TCM Speed Level. Чёрная, размер L. Надёжная защита для города и трассы.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "TCM",
            "material": "Текстиль", "sizes": ["L"], "colors": ["Чёрный"],
            "features": ["Текстильный материал", "Защитные вставки"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 2. SPG (South Pole Gear) — textile jacket, XL, white-blue
    {
        "id": "equip-jacket-spg-south-pole",
        "make": "SPG",
        "model": "South Pole Gear",
        "description": "Текстильная мотокуртка SPG South Pole Gear. Бело-синяя, размер XL. Яркая и заметная.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "SPG",
            "material": "Текстиль", "sizes": ["XL"], "colors": ["Бело-синий"],
            "features": ["Текстильный материал", "Яркий цвет"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 3. FLM Technology — leather jacket, 42, black, ventilation
    {
        "id": "equip-jacket-flm-technology",
        "make": "FLM",
        "model": "Technology",
        "description": "Кожаная мотокуртка FLM Technology. Чёрная, размер 42. Воздушные клапаны вентиляции («продувайки»).",
        "daily_price": 700,
        "specs": {
            "category": "jacket", "badge": "essential", "brand": "FLM",
            "material": "Кожа", "sizes": ["42"], "colors": ["Чёрный"],
            "features": ["Кожаный материал", "Воздушные клапаны вентиляции"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 4. No name (vintage leather) — M, black-blue-white
    {
        "id": "equip-jacket-vintage-leather",
        "make": "No name",
        "model": "Vintage Leather",
        "description": "Винтажная кожаная мотокуртка («олдовая»). Чёрно-сине-белая, размер M (приблизительно). Классический ретро-стиль.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "No name",
            "material": "Кожа", "sizes": ["M"], "colors": ["Чёрно-сине-белый"],
            "features": ["Кожаный материал", "Винтажный стиль"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 5. Pharao Enduro Equipment (Polo) — textile, XL, grey-orange
    {
        "id": "equip-jacket-pharao-enduro",
        "make": "Pharao",
        "model": "Enduro Equipment",
        "description": "Текстильная куртка для эндуро Pharao Enduro Equipment. Серо-оранжевая, размер XL. Отличный выбор для бездорожья.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "Pharao",
            "material": "Текстиль", "sizes": ["XL"], "colors": ["Серо-оранжевый"],
            "features": ["Текстильный материал", "Эндуро-комплектация"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 6. ProBiker (Grio) — textile jacket, 50
    {
        "id": "equip-jacket-probiker-grio",
        "make": "ProBiker",
        "model": "Grio",
        "description": "Текстильная мотокуртка ProBiker Grio. Размер 50. Надпись «Grio».",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "ProBiker",
            "material": "Текстиль", "sizes": ["50"],
            "features": ["Текстильный материал"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "features": "Особенности"}
        }
    },
    # 7. Pharao Adventure Equipment — textile, XL (54-56), black-orange
    {
        "id": "equip-jacket-pharao-adventure",
        "make": "Pharao",
        "model": "Adventure Equipment",
        "description": "Текстильная куртка для приключений Pharao Adventure Equipment. Чёрно-оранжевая, размер XL (54–56). Прочная и универсальная.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "Pharao",
            "material": "Текстиль", "sizes": ["XL (54–56)"], "colors": ["Чёрно-оранжевый"],
            "features": ["Текстильный материал", "Adventure-комплектация"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 8. Racing Energy System — leather+textile, S, black/white-grey, carbon shoulders
    {
        "id": "equip-jacket-racing-energy",
        "make": "Racing Energy",
        "model": "System",
        "description": "Комбинированная мотокуртка Racing Energy System. Кожа + текстиль, размер S. Чёрная с бело-серыми вставками. Карбоновая защита плеч.",
        "daily_price": 700,
        "specs": {
            "category": "jacket", "badge": "essential", "brand": "Racing Energy",
            "material": "Кожа + текстиль", "sizes": ["S"], "colors": ["Чёрный с бело-серым"],
            "features": ["Карбоновая защита плеч", "Комбинированный материал"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 9. Dainese — leather jacket, 48, black, women's
    {
        "id": "equip-jacket-dainese-womens",
        "make": "Dainese",
        "model": "Women's Leather",
        "description": "Женская кожаная мотокуртка Dainese. Чёрная, размер 48. Премиальное качество и посадка.",
        "daily_price": 700,
        "specs": {
            "category": "jacket", "badge": "bestseller", "brand": "Dainese",
            "material": "Кожа", "sizes": ["48"], "colors": ["Чёрный"],
            "features": ["Женская модель", "Кожаный материал", "Премиум-бренд"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 10. Broger — textile jacket, L, black checkered
    {
        "id": "equip-jacket-broger",
        "make": "Broger",
        "model": "Checkered",
        "description": "Текстильная мотокуртка Broger. Чёрная в клетку, размер L. Стильный дизайн.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "Broger",
            "material": "Текстиль", "sizes": ["L"], "colors": ["Чёрный в клетку"],
            "features": ["Текстильный материал", "Дизайн в клетку"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 11. Ducati — textile jacket, L, yellow-orange
    {
        "id": "equip-jacket-ducati",
        "make": "Ducati",
        "model": "Racing Jacket",
        "description": "Текстильная мотокуртка Ducati. Жёлто-оранжевая, размер L. Заметный гоночный стиль.",
        "daily_price": 600,
        "specs": {
            "category": "jacket", "badge": "bestseller", "brand": "Ducati",
            "material": "Текстиль", "sizes": ["L"], "colors": ["Жёлто-оранжевый"],
            "features": ["Гоночный стиль", "Премиум-бренд", "Заметный цвет"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 12. Louis — leather jacket, 54
    {
        "id": "equip-jacket-louis",
        "make": "Louis",
        "model": "Leather Jacket",
        "description": "Кожаная мотокуртка Louis. Размер 54. Классическая кожаная защита.",
        "daily_price": 700,
        "specs": {
            "category": "jacket", "badge": "essential", "brand": "Louis",
            "material": "Кожа", "sizes": ["54"],
            "features": ["Кожаный материал"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "features": "Особенности"}
        }
    },
    # 13. Hein Gericke — textile jacket, 36, grey-black
    {
        "id": "equip-jacket-hein-gericke-36",
        "make": "Hein Gericke",
        "model": "Grey-Black",
        "description": "Текстильная мотокуртка Hein Gericke. Серо-чёрная, размер 36. Немецкое качество.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "Hein Gericke",
            "material": "Текстиль", "sizes": ["36"], "colors": ["Серо-чёрный"],
            "features": ["Текстильный материал"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 14. Polo / Scotchlite — textile jacket, XS, green-purple-red, vintage 80s
    {
        "id": "equip-jacket-polo-scotchlite",
        "make": "Polo",
        "model": "Scotchlite 3M",
        "description": "Винтажная текстильная куртка Polo со светоотражателями 3M Scotchlite (80-е гг.). Зелёно-фиолетово-красная, размер XS. Редкий ретро-экземпляр.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "Polo",
            "material": "Текстиль", "sizes": ["XS"], "colors": ["Зелёно-фиолетово-красный"],
            "features": ["Светоотражатели 3M Scotchlite", "Винтаж 80-х годов"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 15. KTM — textile jacket, dark green, no size
    {
        "id": "equip-jacket-ktm",
        "make": "KTM",
        "model": "Textile Jacket",
        "description": "Текстильная мотокуртка KTM. Тёмно-зелёная. Оригинальный бренд KTM.",
        "daily_price": 600,
        "specs": {
            "category": "jacket", "badge": "bestseller", "brand": "KTM",
            "material": "Текстиль", "colors": ["Тёмно-зелёный"],
            "features": ["Премиум-бренд", "Текстильный материал"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 16. ProBiker — textile jacket, 40, black-white
    {
        "id": "equip-jacket-probiker-40",
        "make": "ProBiker",
        "model": "Black-White",
        "description": "Текстильная мотокуртка ProBiker. Чёрная с белым, размер 40.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "ProBiker",
            "material": "Текстиль", "sizes": ["40"], "colors": ["Чёрный с белым"],
            "features": ["Текстильный материал"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 17. Air System — textile jacket, 2XL, black-toxic-green
    {
        "id": "equip-jacket-air-system-2xl",
        "make": "Air System",
        "model": "Toxic Green",
        "description": "Текстильная мотокуртка Air System. Чёрная с ядовито-зелёным, размер 2XL. Яркий и заметный дизайн.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "Air System",
            "material": "Текстиль", "sizes": ["2XL"], "colors": ["Чёрный с ядовито-зелёным"],
            "features": ["Текстильный материал", "Заметный цвет"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 18. Bullson — textile jacket, oversized, black-red
    {
        "id": "equip-jacket-bullson",
        "make": "Bullson",
        "model": "Oversized",
        "description": "Текстильная мотокуртка Bullson. Чёрно-красная, очень крупный размер («здоровенный»). Подходит для крупных райдеров.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "Bullson",
            "material": "Текстиль", "sizes": ["Очень большой"], "colors": ["Чёрно-красный"],
            "features": ["Оверсайз-размер", "Текстильный материал"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 19. Iruka / Air System — textile jacket, red-black, no size
    {
        "id": "equip-jacket-iruka-air-system",
        "make": "Iruka",
        "model": "Air System",
        "description": "Текстильная мотокуртка Iruka / Air System. Красно-чёрная.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "Iruka",
            "material": "Текстиль", "colors": ["Красно-чёрный"],
            "features": ["Текстильный материал"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 20. Hein Gericke (camo) — textile jacket, 54, black-camo
    {
        "id": "equip-jacket-hein-gericke-camo",
        "make": "Hein Gericke",
        "model": "Camo",
        "description": "Текстильная мотокуртка Hein Gericke с камуфляжными вставками. Чёрная с камуфляжем, размер 54.",
        "daily_price": 500,
        "specs": {
            "category": "jacket", "badge": "versatile", "brand": "Hein Gericke",
            "material": "Текстиль", "sizes": ["54"], "colors": ["Чёрный с камуфляжем"],
            "features": ["Камуфляжные вставки", "Текстильный материал"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "colors": "Цвета", "features": "Особенности"}
        }
    },
    # 21. Edges Leather — leather pants, size 3
    {
        "id": "equip-pants-edges-leather",
        "make": "Edges",
        "model": "Leather Pants",
        "description": "Кожаные мотоштаны Edges Leather. Размер 3. Полноценная кожаная защита для трека и трассы.",
        "daily_price": 700,
        "specs": {
            "category": "pants", "badge": "essential", "brand": "Edges",
            "material": "Кожа", "sizes": ["3"],
            "features": ["Кожаный материал", "Защита для трека"],
            "spec_labels": {"category": "Категория", "badge": "Бейдж", "brand": "Бренд", "material": "Материал", "sizes": "Размеры", "features": "Особенности"}
        }
    },
]


def delete_old_equipment():
    """Delete the 7 old seed equipment items."""
    old_ids = [
        "equip-helmet-street-pro", "equip-jacket-trail-guard", "equip-pants-trail-adv",
        "equip-gloves-summer-x", "equip-boots-tour-adv", "equip-disc-lock-pro",
        "equip-communicator-bt",
    ]
    for old_id in old_ids:
        url = f"{SUPABASE_URL}/rest/v1/cars?id=eq.{old_id}"
        req = urllib.request.Request(url, method="DELETE", headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Prefer": "return=minimal",
        })
        try:
            urllib.request.urlopen(req)
            print(f"  Deleted: {old_id}")
        except Exception as e:
            print(f"  Delete error {old_id}: {e}")


def insert_item(item):
    """Insert a single equipment item."""
    data = json.dumps({
        "id": item["id"],
        "make": item["make"],
        "model": item["model"],
        "description": item["description"],
        "daily_price": item["daily_price"],
        "image_url": "",
        "type": "equipment",
        "crew_id": VIP_BIKE_CREW_ID,
        "owner_id": OWNER_ID,
        "specs": item["specs"],
    }).encode()

    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/cars",
        method="POST",
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        data=data,
    )
    try:
        urllib.request.urlopen(req)
        print(f"  Inserted: {item['id']}")
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"  ERROR {item['id']}: {e.code} {body[:100]}")
        return False


def main():
    print("=== Equipment Insert from PDF Inventory ===\n")

    print("Step 1: Delete old 7 seed equipment items")
    delete_old_equipment()

    print(f"\nStep 2: Insert {len(ITEMS)} new equipment items")
    success = 0
    for item in ITEMS:
        if insert_item(item):
            success += 1

    print(f"\n=== Done: {success}/{len(ITEMS)} items inserted ===")
    print(f"Categories: {len([i for i in ITEMS if i['specs']['category'] == 'jacket'])} jackets, {len([i for i in ITEMS if i['specs']['category'] == 'pants'])} pants")


if __name__ == "__main__":
    main()
