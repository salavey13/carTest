-- Repeat for each table; use the same E.164 logic as normalizePhone().
UPDATE public.franchize_intents
  SET phone = CASE
    WHEN phone ~ '^8\d{10}$' THEN '+7' || substring(phone from 2)
    WHEN phone ~ '^7\d{10}$' THEN '+' || phone
    WHEN phone ~ '^\d{10}$' THEN '+7' || phone
    WHEN phone ~ '^\+' THEN phone
    ELSE phone
  END
  WHERE phone IS NOT NULL;

UPDATE public.crew_todos
  SET phone = CASE
    WHEN phone ~ '^8\d{10}$' THEN '+7' || substring(phone from 2)
    WHEN phone ~ '^7\d{10}$' THEN '+' || phone
    WHEN phone ~ '^\d{10}$' THEN '+7' || phone
    WHEN phone ~ '^\+' THEN phone
    ELSE phone
  END
  WHERE phone IS NOT NULL;

UPDATE private.rental_contract_artifacts
  SET renter_phone = CASE
    WHEN renter_phone ~ '^8\d{10}$' THEN '+7' || substring(renter_phone from 2)
    WHEN renter_phone ~ '^7\d{10}$' THEN '+' || renter_phone
    WHEN renter_phone ~ '^\d{10}$' THEN '+7' || renter_phone
    WHEN renter_phone ~ '^\+' THEN renter_phone
    ELSE renter_phone
  END
  WHERE renter_phone IS NOT NULL;

UPDATE private.sale_contract_artifacts
  SET buyer_phone = CASE
    WHEN buyer_phone ~ '^8\d{10}$' THEN '+7' || substring(buyer_phone from 2)
    WHEN buyer_phone ~ '^7\d{10}$' THEN '+' || buyer_phone
    WHEN buyer_phone ~ '^\d{10}$' THEN '+7' || buyer_phone
    WHEN buyer_phone ~ '^\+' THEN buyer_phone
    ELSE buyer_phone
  END
  WHERE buyer_phone IS NOT NULL;
