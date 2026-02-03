import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    try {
        const prefix = req.nextUrl.searchParams.get('prefix');

        if (!prefix || prefix.length !== 5) {
            return NextResponse.json({ error: 'Invalid prefix' }, { status: 400 });
        }

        // HIBP k-Anonymity API
        const hibpRes = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
            headers: {
                'Add-Padding': 'true' // Recommended for privacy
            }
        });

        if (!hibpRes.ok) {
            return NextResponse.json({ error: 'HIBP API failed' }, { status: 502 });
        }

        const data = await hibpRes.text();

        // Return as plain text for efficiency
        return new NextResponse(data, {
            headers: { 'Content-Type': 'text/plain' }
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
