import { convertTextDateToTimestamp, parseRuDateParts } from '../../lib/rental-date-utils';

describe('convertTextDateToTimestamp', () => {
  test('should convert DD.MM.YYYY and HH:MM to ISO timestamp (UTC+3)', () => {
    // Moscow time 18:00 on 17.06.2026 = 15:00 UTC
    const result = convertTextDateToTimestamp('17.06.2026', '18:00', 3);
    expect(result).toBe('2026-06-17T15:00:00.000Z');
  });

  test('should handle midnight correctly', () => {
    const result = convertTextDateToTimestamp('17.06.2026', '00:00', 3);
    expect(result).toBe('2026-06-16T21:00:00.000Z');
  });

  test('should handle different timezone offsets', () => {
    const result = convertTextDateToTimestamp('17.06.2026', '18:00', 0);
    expect(result).toBe('2026-06-17T18:00:00.000Z');
  });

  test('should handle single-digit hour/minute', () => {
    const result = convertTextDateToTimestamp('17.06.2026', '9:5', 3);
    expect(result).toBe('2026-06-17T06:05:00.000Z');
  });
});

describe('parseRuDateParts', () => {
  test('should parse DD.MM.YYYY format', () => {
    const result = parseRuDateParts('17.06.2026');
    expect(result).toEqual({ d: 17, m: 5, y: 2026 });
  });

  test('should handle 2-digit year (20xx)', () => {
    const result = parseRuDateParts('17.06.26');
    expect(result).toEqual({ d: 17, m: 5, y: 2026 });
  });

  test('should return null for invalid format', () => {
    expect(parseRuDateParts('invalid')).toBeNull();
    expect(parseRuDateParts('17-06-2026')).toBeNull();
  });
});
