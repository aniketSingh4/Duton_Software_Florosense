
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const sensorId = searchParams.get('sensorId');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Default values as per requirement or reasonable defaults
    const limit = searchParams.get('limit') || '1000';
    const offset = searchParams.get('offset') || '0';
    const sortOrder = searchParams.get('sort_order') || 'asc';

    if (!sensorId) {
        return NextResponse.json({ error: 'Sensor ID is required' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_FLOROSENSE_API_KEY) {
        return NextResponse.json({ error: 'API Configuration Error: Missing API Key' }, { status: 500 });
    }

    // Construct the target URL
    const targetUrl = `${process.env.HISTORICAL_API}v1/dashboard/sensors/${encodeURIComponent(sensorId)}/data/advanced?start_date=${startDate}&end_date=${endDate}&limit=${limit}&offset=${offset}&sort_order=${sortOrder}`;

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.NEXT_PUBLIC_FLOROSENSE_API_KEY
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Florosense API Error: ${response.status} ${response.statusText}`, errorText);
            return NextResponse.json({ error: `Florosense API Error: ${response.statusText}` }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Proxy Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
