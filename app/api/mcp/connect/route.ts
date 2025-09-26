import { NextRequest, NextResponse } from 'next/server';
import { mcpServerManager } from '../../../../lib/mcp-server';

export async function POST(request: NextRequest) {
  try {
    const { id, name, command, args, env, url, transport, authToken, headers } = await request.json();

    if (!id || !name || (!command && !url)) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다 (id, name, command 또는 url)' },
        { status: 400 }
      );
    }

    const config = {
      id,
      name,
      command,
      args: args || [],
      env: env || {},
      url,
      transport: transport || (url ? 'http' : 'stdio'),
      authToken,
      headers: headers || {}
    };

    const connection = await mcpServerManager.connectToServer(config);
    
    return NextResponse.json({
      success: true,
      connection: {
        id: config.id,
        status: connection.status,
        lastConnected: connection.lastConnected
      }
    });

  } catch (error) {
    console.error('MCP 서버 연결 실패:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '서버 연결에 실패했습니다',
        success: false 
      },
      { status: 500 }
    );
  }
}
