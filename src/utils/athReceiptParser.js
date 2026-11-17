import Tesseract from 'tesseract.js';

const MONTH_MAP = {
  jan: '01', ene: '01',
  feb: '02',
  mar: '03',
  apr: '04', abr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08', ago: '08',
  sep: '09', set: '09',
  oct: '10',
  nov: '11',
  dec: '12', dic: '12'
};

function parseReceiptDate(rawText) {
  // Match ATH Movil format: "Date: Nov/16/2026" or "Nov 16, 2026" or "11/16/2026"
  const monthNameMatch = rawText.match(
    /(?:Date|Fecha)?[:\s]*\b(Jan|Ene|Feb|Mar|Apr|Abr|May|Jun|Jul|Aug|Ago|Sep|Set|Oct|Nov|Dec|Dic)[/\s.-]+(\d{1,2})[/\s,.-]+(\d{4})/i
  );
  if (monthNameMatch) {
    const mKey = monthNameMatch[1].toLowerCase().slice(0, 3);
    const month = MONTH_MAP[mKey] || '11';
    const day = String(monthNameMatch[2]).padStart(2, '0');
    const year = monthNameMatch[3];
    return `${year}-${month}-${day}`;
  }

  const numericMatch = rawText.match(/(?:Date|Fecha)[:\s]*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/i);
  if (numericMatch) {
    const m = String(numericMatch[1]).padStart(2, '0');
    const d = String(numericMatch[2]).padStart(2, '0');
    const y = numericMatch[3];
    return `${y}-${m}-${d}`;
  }

  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a single Message string whether the user followed the hyphen instructions
 * ("Darinel Villegas - Camper 30 - 3") OR wrote it without hyphens
 * ("Doris Cutino #31 2 personas", "Doris Cutino Camper 31 2", etc.)
 */
export function parseMessageContent(messageStr = '') {
  let remaining = String(messageStr || '').trim();
  if (!remaining) {
    return { name: '', camperNumber: '', peopleCount: '' };
  }

  let name = '';
  let camperNumber = '';
  let peopleCount = '';

  // 1. Try strict hyphen-separated format first: "Nombre - Camper # - # personas"
  const strictHyphen = remaining.match(
    /^([A-Za-zÁÉÍÓÚÑáéíóúñ\s.]{2,45}?)\s*[-–—/|]+\s*(?:camper|lote|#)?\s*#?\s*(\d{1,3}[A-Za-z]?)\s*[-–—/|]+\s*(\d{1,2})\s*(?:personas?|pers\.?|p)?$/i
  );
  if (strictHyphen) {
    return {
      name: strictHyphen[1].trim().replace(/\s+/g, ' '),
      camperNumber: `Camper ${strictHyphen[2].trim()}`,
      peopleCount: String(parseInt(strictHyphen[3], 10))
    };
  }

  // 2. Flexible extraction (handles "Doris Cutino #31 2 personas", "Doris Cutino Camper 31 2 personas", etc.)
  // 2a. Extract explicit camper/lot/# number e.g. "#31", "Camper 31", "Camper #31", "Lote 31"
  const explicitCamper = remaining.match(/(?:camper|lote|lot)\s*#?\s*(\d{1,3}[A-Za-z]?)|#\s*(\d{1,3}[A-Za-z]?)/i);
  if (explicitCamper) {
    const num = explicitCamper[1] || explicitCamper[2];
    camperNumber = `Camper ${num}`;
    remaining = remaining.replace(explicitCamper[0], ' ');
  }

  // 2b. Extract explicit people count e.g. "2 personas", "3 pers", "2p"
  const explicitPeople = remaining.match(/\b(\d{1,2})\s*(?:personas?|pers\.?|invitados?|adultos?|p\b)/i);
  if (explicitPeople) {
    peopleCount = String(parseInt(explicitPeople[1], 10));
    remaining = remaining.replace(explicitPeople[0], ' ');
  }

  // 2c. If camperNumber or peopleCount are still missing, look for standalone numbers left in the message
  const leftoverNumbers = [...remaining.matchAll(/\b(\d{1,3})\b/g)];
  if (!camperNumber && !peopleCount && leftoverNumbers.length >= 2) {
    camperNumber = `Camper ${leftoverNumbers[0][1]}`;
    peopleCount = String(parseInt(leftoverNumbers[1][1], 10));
    remaining = remaining
      .replace(leftoverNumbers[0][0], ' ')
      .replace(leftoverNumbers[1][0], ' ');
  } else if (!camperNumber && leftoverNumbers.length >= 1) {
    camperNumber = `Camper ${leftoverNumbers[0][1]}`;
    remaining = remaining.replace(leftoverNumbers[0][0], ' ');
  } else if (!peopleCount && leftoverNumbers.length >= 1) {
    peopleCount = String(parseInt(leftoverNumbers[0][1], 10));
    remaining = remaining.replace(leftoverNumbers[0][0], ' ');
  }

  // 2d. Whatever alphabetic words remain in the message is the Camper's Name!
  const cleanedName = remaining
    .replace(/[-–—/|,.:#()]+/g, ' ')
    .replace(/\b(?:camper|lote|personas?|pers)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanedName.length >= 2) {
    name = cleanedName;
  }

  return { name, camperNumber, peopleCount };
}

/**
 * Parses full text extracted from an ATH Móvil receipt screenshot or email notification.
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
  let sentByInfo = '';
  const detectedDate = parseReceiptDate(cleanText);

  // 1. Extract Amount — prioritize "Amount: $70.00" or "Monto: $70.00" or "Transfer receipt: $70.00"
  const labeledAmount = cleanText.match(
    /(?:Amount|Monto|Total|Cantidad|Transfer receipt)[:\s]*\$\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/i
  );
  if (labeledAmount) {
    amount = String(parseFloat(labeledAmount[1].replace(/,/g, '')));
  } else {
    const moneyRegex = /\$\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/g;
    let m;
    while ((m = moneyRegex.exec(cleanText)) !== null) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && val < 10000) {
        amount = String(val);
        break;
      }
    }
  }

  // 2. Extract "Sent by:" line (e.g. "Sent by: Dorinel Casanova - (787) 675-8202")
  let senderFallbackName = '';
  for (const line of lines) {
    const sentByMatch = line.match(/^(?:Sent by|Enviado por|De)[:\s]+(.+)$/i);
    if (sentByMatch) {
      const rawSentBy = sentByMatch[1].trim();
      sentByInfo = rawSentBy;
      // Extract just the person's name before the phone number "- (787)..."
      const nameBeforePhone = rawSentBy.split(/\s*[-–—]\s*\(?\d{3}/)[0].trim();
      if (nameBeforePhone && /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s.]+$/.test(nameBeforePhone)) {
        senderFallbackName = nameBeforePhone;
      }
      break;
    }
  }

  // 3. Extract "Message:" / "Mensaje:" line FIRST (this is where the camper info is!)
  let messageLineContent = '';
  for (let i = 0; i < lines.length; i++) {
    const msgMatch = lines[i].match(/^(?:Message|Mensaje|Nota|Concepto)[:\s]*(.*)$/i);
    if (msgMatch) {
      messageLineContent = msgMatch[1].trim();
      // If "Message:" was on its own line and the content is on the next line, grab the next line
      if (!messageLineContent && i + 1 < lines.length) {
        messageLineContent = lines[i + 1].trim();
      }
      break;
    }
  }

  if (messageLineContent) {
    const parsedMsg = parseMessageContent(messageLineContent);
    name = parsedMsg.name;
    camperNumber = parsedMsg.camperNumber;
    peopleCount = parsedMsg.peopleCount;
  } else {
    // If there is no "Message:" label (e.g. user pasted just the message line in the quick box),
    // find any line that is NOT "Sent by:", "Date:", "Amount:", "Transfer receipt:"
    for (const line of lines) {
      if (/^(?:Sent by|Enviado por|Date|Fecha|Amount|Monto|Transfer receipt|Hi |You received|As a reminder|security codes|to me|ATH M)/i.test(line)) {
        continue;
      }
      const candidate = parseMessageContent(line);
      if (candidate.camperNumber && (candidate.name || candidate.peopleCount)) {
        name = candidate.name;
        camperNumber = candidate.camperNumber;
        peopleCount = candidate.peopleCount;
        break;
      }
    }
  }

  // 4. If the person forgot to write their name in Message: (e.g. only wrote "#31 2 personas"),
  // use the name from "Sent by:"
  if (!name && senderFallbackName) {
    name = senderFallbackName;
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
      reference: sentByInfo ? `Enviado por: ${sentByInfo}` : '',
      messageRaw: messageLineContent,
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
