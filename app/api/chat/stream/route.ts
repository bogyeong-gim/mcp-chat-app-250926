import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!message) {
      return new Response('Message is required', { status: 400 });
    }

    // Gemini API 키 확인
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return new Response('GEMINI_API_KEY not configured', { status: 500 });
    }

    console.log('API Key found, initializing GoogleGenAI client...');
    
    // GoogleGenAI 클라이언트 초기화
    const ai = new GoogleGenAI({ apiKey });

    // 스트리밍 응답 생성
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('Creating chat session with model: gemini-2.0-flash-001');
          
          // 채팅 세션 생성
          const chat = ai.chats.create({
            model: 'gemini-2.0-flash-001',
            config: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
            history: history || []
          });

          console.log('Sending message to Gemini API...');
          
          // 스트리밍 메시지 전송
          const responseStream = await chat.sendMessageStream({
            message: message
          });

          console.log('Received response stream, processing chunks...');

          // 스트리밍 응답 처리
          for await (const chunk of responseStream) {
            if (chunk.text) {
              const data = encoder.encode(`data: ${JSON.stringify({
                type: 'token',
                content: chunk.text,
                done: false
              })}\n\n`);
              controller.enqueue(data);
            }
          }

          // 스트리밍 완료
          const finalChunk = encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            content: '',
            done: true
          })}\n\n`);
          controller.enqueue(finalChunk);
          controller.close();

        } catch (error) {
          console.error('Gemini API error:', error);
          let errorMessage = 'AI 응답 생성 중 오류가 발생했습니다.';
          
          if (error instanceof Error) {
            if (error.message.includes('API key')) {
              errorMessage = 'API 키가 올바르지 않습니다. 환경 변수를 확인해주세요.';
            } else if (error.message.includes('quota')) {
              errorMessage = 'API 할당량을 초과했습니다. 잠시 후 다시 시도해주세요.';
            } else if (error.message.includes('network')) {
              errorMessage = '네트워크 연결을 확인해주세요.';
            } else {
              errorMessage = `API 오류: ${error.message}`;
            }
          }
          
          const errorChunk = encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            content: errorMessage,
            done: true
          })}\n\n`);
          controller.enqueue(errorChunk);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Streaming error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
