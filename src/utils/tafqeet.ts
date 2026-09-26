/**
 * Simple, robust Arabic number to words converter (Tafqeet) for SAR receipts
 */
export function tafqeetSAR(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'صفر ريال سعودي فقط لا غير';

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const teens = [
    'عشرة',
    'أحد عشر',
    'اثنا عشر',
    'ثلاثة عشر',
    'أربعة عشر',
    'خمسة عشر',
    'ستة عشر',
    'سبعة عشر',
    'ثمانية عشر',
    'تسعة عشر',
  ];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = [
    '',
    'مائة',
    'مائتان',
    'ثلاثمائة',
    'أربعمائة',
    'خمسمائة',
    'ستمائة',
    'سبعمائة',
    'ثمانمائة',
    'تسعمائة',
  ];

  function convertGroup(n: number): string {
    let result = '';
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const o = remainder % 10;

    if (h > 0) {
      result += hundreds[h];
    }

    if (remainder > 0) {
      if (result) result += ' و ';
      if (remainder < 10) {
        result += ones[remainder];
      } else if (remainder < 20) {
        result += teens[remainder - 10];
      } else {
        if (o > 0) {
          result += `${ones[o]} و ${tens[t]}`;
        } else {
          result += tens[t];
        }
      }
    }
    return result;
  }

  const integerPart = Math.floor(amount);
  const halalas = Math.round((amount - integerPart) * 100);

  let parts: string[] = [];

  const millions = Math.floor(integerPart / 1000000);
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  const rem = integerPart % 1000;

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${convertGroup(millions)} ملايين`);
    else parts.push(`${convertGroup(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertGroup(thousands)} آلاف`);
    else parts.push(`${convertGroup(thousands)} ألف`);
  }

  if (rem > 0) {
    parts.push(convertGroup(rem));
  }

  let text = parts.join(' و ') + ' ريال سعودي';
  if (halalas > 0) {
    text += ` و ${convertGroup(halalas)} هللة`;
  }
  text += ' فقط لا غير';
  return text;
}
