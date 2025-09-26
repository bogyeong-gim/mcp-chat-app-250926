import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: '파일이 선택되지 않았습니다.' }, { status: 400 });
    }

    const uploadDir = join(process.cwd(), 'public', 'uploads');
    
    // 업로드 디렉토리가 없으면 생성
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const uploadedFiles = [];

    for (const file of files) {
      // 파일 크기 제한 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ 
          error: `파일 ${file.name}의 크기가 10MB를 초과합니다.` 
        }, { status: 400 });
      }

      // 허용된 파일 타입 체크
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'text/plain', 'text/csv', 'application/pdf',
        'video/mp4', 'video/webm',
        'audio/mp3', 'audio/wav', 'audio/ogg'
      ];

      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ 
          error: `지원하지 않는 파일 형식입니다: ${file.type}` 
        }, { status: 400 });
      }

      // 고유한 파일명 생성
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = file.name.split('.').pop();
      const fileName = `${timestamp}_${randomString}.${fileExtension}`;
      const filePath = join(uploadDir, fileName);

      // 파일 저장
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      uploadedFiles.push({
        originalName: file.name,
        fileName: fileName,
        path: `/uploads/${fileName}`,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString()
      });
    }

    return NextResponse.json({ 
      success: true, 
      files: uploadedFiles 
    });

  } catch (error) {
    console.error('파일 업로드 오류:', error);
    return NextResponse.json({ 
      error: '파일 업로드 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { fileName } = await request.json();
    
    if (!fileName) {
      return NextResponse.json({ error: '파일명이 필요합니다.' }, { status: 400 });
    }

    const filePath = join(process.cwd(), 'public', 'uploads', fileName);
    
    if (existsSync(filePath)) {
      const { unlink } = await import('fs/promises');
      await unlink(filePath);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('파일 삭제 오류:', error);
    return NextResponse.json({ 
      error: '파일 삭제 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
