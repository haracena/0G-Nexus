import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'metadata-db.json');

async function readDb() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

export async function GET(
  request: Request,
  props: { params: Promise<{ hash: string }> }
) {
  try {
    const url = new URL(request.url);
    const queryHash = url.searchParams.get("hash");
    const { hash: pathHash } = await props.params;
    
    const rawHash = queryHash || pathHash;
    if (!rawHash) {
      return NextResponse.json({ success: false, error: "Hash parameter is required" }, { status: 400 });
    }
    
    // Normalize hash: strip 0g:// prefix if present
    const normalizedHash = rawHash.replace("0g://", "");
    
    const db = await readDb();
    const metadata = db[normalizedHash];
    
    if (metadata) {
      return NextResponse.json({ success: true, metadata });
    }
    
    // Generous fallback for dynamic mock campaigns
    return NextResponse.json({
      success: true,
      metadata: {
        title: `Incentive Campaign #${normalizedHash.slice(0, 6)}`,
        description: "Participate in this contract event trigger verification on the 0G Newton Testnet to earn rewards.",
        conditions: {}
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
