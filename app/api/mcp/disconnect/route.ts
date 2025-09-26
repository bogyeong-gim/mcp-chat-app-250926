import { NextRequest, NextResponse } from 'next/server';
import { mcpServerManager } from '../../../../lib/mcp-server';

export async function POST(request: NextRequest) {
  try {
    const { connectionId } = await request.json();

    if (!connectionId) {
      return NextResponse.json(
        { error: '연결 ID가 필요합니다' },
        { status: 400 }
      );
    }

    await mcpServerManager.disconnectServer(connectionId);
    
    return NextResponse.json({
      success: true,
      message: '서버 연결이 해제되었습니다'
    });

  } catch (error) {
    console.error('MCP 서버 연결 해제 실패:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '서버 연결 해제에 실패했습니다',
        success: false 
      },
      { status: 500 }
    );
  }
}
