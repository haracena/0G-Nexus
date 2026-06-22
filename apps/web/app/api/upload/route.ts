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

async function writeDb(db: any) {
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error("Failed to write metadata db:", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { title, description, targetContract, targetEvent, conditions } = body;
    
    // Generate a pseudo-random hash to mock 0G Storage hash
    const mockHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    const uri = `0g://${mockHash}`;
    
    // Read current metadata db, update, and write back
    const db = await readDb();
    db[mockHash] = {
      title,
      description,
      targetContract,
      targetEvent,
      conditions,
      createdAt: body.createdAt || new Date().toISOString()
    };
    await writeDb(db);
    
    return NextResponse.json({ 
      success: true, 
      uri: uri,
      dataHash: mockHash,
      message: "Metadata stored on 0G Storage successfully (Mocked & Cached)" 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to upload" }, { status: 500 });
  }
}
