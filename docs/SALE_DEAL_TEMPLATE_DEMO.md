# Договор купли-продажи мототехники № {{ contract_number }}

г. {{ return_address }}  
{{ contract_date }}

Продавец: **{{ issuer_name }}**, представитель **{{ issuer_representative }}**.
Покупатель: **{{ renter_full_name }}**, телефон **{{ renter_phone }}**.

## 1. Предмет договора
Продавец передает в собственность покупателю транспортное средство: **{{ bike_make_model }}**.

- VIN / рама: {{ bike_vin }}
- Гос. номер: {{ bike_plate }}
- Пробег: {{ bike_mileage }}

## 2. Стоимость и порядок расчетов
- Базовая стоимость: **{{ subtotal_rub }} ₽**
- Доп. опции: **{{ extras_total_rub }} ₽**
- Итог к оплате: **{{ total_price_rub }} ₽**

Дополнительные позиции:

| Позиция | Кол-во | Цена | Сумма |
| --- | --- | --- | --- |
{{ extras_rows }}

## 3. Передача и проверка состояния
Передача техники и документов осуществляется по адресу: **{{ return_address }}**.

Покупатель подтверждает осмотр техники и отсутствие претензий по внешнему виду/комплектации на момент подписания.

## 4. Подписи сторон
Подпись покупателя (WebApp): **{{ renter_signature }}**  
Fingerprint: `{{ signature_fingerprint }}`  
Timestamp: `{{ signature_timestamp }}`

Верификация: `{{ verified_at }}`  
Document key: `{{ document_key }}`
