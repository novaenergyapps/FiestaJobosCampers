import Tesseract from 'tesseract.js';

/**
 * Parses text extracted from an ATH Móvil receipt or email notification.
 * Expected user message pattern:
 *   "Nombre - # Camper - # personas"
 *   Example: "Darinel Villegas - Camper 30 - 3"
 */
export function parseAthReceiptText(rawText = '') {
  const cleanText = String(rawText || '').replace(/\r/g, '\n');
  const lines = cleanText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let amount = '';
  let name = '';
  let camperNumber = '';
  let peopleCount = '';
  let reference = '';
  let detectedDate = new Date().toISOString().slice(0, 10);

  // 1. Extract Amount ($XX.XX or XX.XX near Total/Monto/Pagado/Enviado)
  const moneyMatches = [];
  const moneyRegex = /\$\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/g;
  let m;
  while ((m = moneyRegex.exec(cleanText)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0 && val < 10000) {
      moneyMatches.push(val);
    }
  }
  if (moneyMatches.length > 0) {
    amount = String(moneyMatches[0]);
  } else {
    // Fallback for amounts written like "Monto 45.00" or "Total: 30.00"
    const altMoney = cleanText.match(/(?:total|monto|cantidad|pago|pagado|amount)[:\s]*\$?\s*(\d{1,4}(?:\.\d{2}))/i);
    if (altMoney) {
      amount = String(parseFloat(altMoney[1]));
    }
  }

  // 2. Extract Reference / Confirmation number if present
  const refMatch = cleanText.match(/(?:referencia|confirmaci[oó]n|transacci[oó]n|ref|id|n[uú]mero)[:\s#]*([A-Z0-9-]{5,22})/i);
  if (refMatch) {
    reference = refMatch[1].trim();
  }

  // 3. Look for the requested pattern: "Nombre - Camper # - # personas"
  // E.g. "Darinel Villegas - Camper 30 - 3" or "Juan Perez - #30 - 3 personas" or "Maria Soto - Lote 12 - 2"
  const hyphenLineRegex = /([A-Za-zÁÉÍÓÚÑáéíóúñ\s.]{3,45})\s*[-–—/|]\s*(?:camper|lote|#)?\s*#?\s*([0-9A-Za-z-]+)\s*[-–—/|]\s*(\d{1,2})\s*(?:personas|pers|p)?/i;

  for (const line of lines) {
    const match = line.match(hyphenLineRegex);
    if (match) {
      name = match[1].trim().replace(/\s+/g, ' ');
      const rawCamper = match[2].trim();
      camperNumber = /^camper/i.test(rawCamper) ? rawCamper : `Camper ${rawCamper}`;
      peopleCount = String(parseInt(match[3], 10));
      break;
    }
  }

  // Also check across full text if line wraps broke the hyphens
  if (!name || !camperNumber || !peopleCount) {
    const fullMatch = cleanText.match(hyphenLineRegex);
    if (fullMatch) {
      name = name || fullMatch[1].trim().replace(/\s+/g, ' ');
      const rawCamper = fullMatch[2].trim();
      camperNumber = camperNumber || (/^camper/i.test(rawCamper) ? rawCamper : `Camper ${rawCamper}`);
      peopleCount = peopleCount || String(parseInt(fullMatch[3], 10));
    }
  }

  // 4. Partial fallback detection if the sender didn't follow the exact hyphen format
  if (!camperNumber) {
    const camperMatch = cleanText.match(/(?:camper|lote)\s*#?\s*(\d{1,3}[A-Za-z]?)/i);
    if (camperMatch) {
      camperNumber = `Camper ${camperMatch[1]}`;
    }
  }

  if (!peopleCount) {
    const peopleMatch = cleanText.match(/(\d{1,2})\s*(?:personas|persona|adultos|invitados|pers)\b/i);
    if (peopleMatch) {
      peopleCount = String(parseInt(peopleMatch[1], 10));
    }
  }

  if (!name) {
    // Look for "De: Nombre" or "Enviado por: Nombre" or "Nombre:" in ATH Móvil email/receipt
    const senderMatch = cleanText.match(/(?:de parte de|enviado por|pagado por|cliente|nombre|de)[:\s]+([A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+){1,3})/i);
    if (senderMatch) {
      name = senderMatch[1].trim();
    }
  }

  const missingFields = [];
  if (!name) missingFields.push('Nombre');
  if (!camperNumber) missingFields.push('# de Camper');
  if (!peopleCount) missingFields.push('# de Personas');
  if (!amount) missingFields.push('Monto ($)');

  const isCompleteFormat = missingFields.length === 0;

  return {
    isCompleteFormat,
    missingFields,
    parsed: {
      name,
      camperNumber,
      peopleCount,
      amount,
      date: detectedDate,
      reference,
      rawText: cleanText
    }
  };
}

/**
 * Runs OCR on an image file or dataUrl and returns parsed ATH Móvil fields.
 */
export async function analyzeAthReceiptImage(imageSource, onProgress) {
  const result = await Tesseract.recognize(imageSource, 'spa+eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    }
  });

  const text = result?.data?.text || '';
  return parseAthReceiptText(text);
}
