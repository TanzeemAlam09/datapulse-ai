import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { extractInvoiceData } from '@/lib/ocr-engine';
// @ts-expect-error pdf-parse types
const pdfParse = require('pdf-parse');

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawText = '';
    let ocrUsed = false;

    // Try text-based PDF first
    try {
      const parsed = await pdfParse(buffer);
      rawText = parsed.text || '';
    } catch {
      // will fall through to OCR
    }

    // If no text found, try Tesseract OCR on the PDF pages
    if (!rawText.trim()) {
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        // Convert buffer to base64 data URL for Tesseract
        const base64 = buffer.toString('base64');
        const dataUrl = `data:application/pdf;base64,${base64}`;
        const { data } = await worker.recognize(dataUrl);
        rawText = data.text || '';
        await worker.terminate();
        ocrUsed = true;
      } catch {
        return NextResponse.json({
          error: 'Could not extract text from this PDF. Please ensure the PDF is readable.',
        }, { status: 422 });
      }
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: 'PDF appears to be empty or unreadable.' }, { status: 422 });
    }

    // Run extraction engine
    const extracted = extractInvoiceData(rawText);

    // ── Duplicate detection ──────────────────────────────────────────────────
    let duplicateWarning = null;
    if (extracted.financials.total_amount && extracted.vendor.name) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const dupes = await sql`
        SELECT id, original_name, created_at
        FROM documents
        WHERE user_id = ${user.userId}
          AND status = 'done'
          AND created_at > ${sevenDaysAgo}
          AND (extracted_data->>'financials')::jsonb->>'total_amount' = ${String(extracted.financials.total_amount)}
          AND extracted_data->'vendor'->>'name' = ${extracted.vendor.name}
        LIMIT 1
      `;
      if (dupes.length > 0) {
        duplicateWarning = {
          message: 'Possible duplicate invoice detected',
          matching_document: dupes[0].original_name,
          uploaded_at: dupes[0].created_at,
        };
      }
    }

    // Store in DB
    const rows = await sql`
      INSERT INTO documents (user_id, original_name, file_size, status, extracted_data, raw_text, processed_at)
      VALUES (
        ${user.userId},
        ${file.name},
        ${file.size},
        'done',
        ${JSON.stringify(extracted)},
        ${rawText.slice(0, 5000)},
        NOW()
      )
      RETURNING id, original_name, file_size, status, created_at, processed_at
    `;

    await sql`
      INSERT INTO audit_log (user_id, action, detail)
      VALUES (${user.userId}, 'upload', ${file.name})
    `;

    return NextResponse.json({
      document_id: rows[0].id,
      status: 'done',
      filename: file.name,
      data: extracted,
      document: rows[0],
      ocr_used: ocrUsed,
      duplicate_warning: duplicateWarning,
    }, { status: 201 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
