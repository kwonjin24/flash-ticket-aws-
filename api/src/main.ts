import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://www.highgarden.cloud',
  'https://dev.highgarden.cloud',
];

async function bootstrap() {
  try {
    console.log(`[API] Starting bootstrap process...`);
    console.log(`[API] NODE_ENV: ${process.env.NODE_ENV ?? 'not set'}`);
    console.log(`[API] PORT: ${process.env.PORT ?? 'not set'}`);

    console.log(`[API] Creating NestFactory application...`);
    const app = await NestFactory.create(AppModule);
    console.log(`[API] ✅ NestFactory application created`);

    console.log(`[API] Configuring CORS...`);
    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          if (origin) {
            console.log(`[API CORS] Allowed origin: ${origin}`);
          }
          callback(null, true);
          return;
        }
        console.warn(`[API CORS] Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    });
    console.log(`[API] ✅ CORS enabled`);

    console.log(`[API] Setting up global validation pipes...`);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    console.log(`[API] ✅ Validation pipes configured`);

    console.log(`[API] Initializing application modules...`);
    const initStartTime = Date.now();
    await app.init();
    console.log(`[API] ✅ Application modules initialized (${Date.now() - initStartTime}ms)`);

    const port = Number(process.env.PORT ?? 4000);
    const host = '0.0.0.0';

    console.log(`[API] Getting HTTP server instance...`);
    const server = app.getHttpServer();
    console.log(`[API] ✅ HTTP server instance obtained`);

    // Set up error handlers
    console.log(`[API] Setting up error handlers...`);
    server.on('error', (error: any) => {
      console.error(`[API] ❌ Server error: ${error.message}`, error.stack);
      process.exit(1);
    });

    server.on('clientError', (error: any) => {
      console.error(`[API] ⚠️ Client error: ${error.message}`);
    });

    console.log(`[API] 🚀 Starting to listen on ${host}:${port}...`);
    const listenStartTime = Date.now();

    // Use the modern listen API with all parameters
    const httpServer = server.listen(port, host, () => {
      const listenTime = Date.now() - listenStartTime;
      console.log(`[API] ✅ HTTP server listening on ${host}:${port} (${listenTime}ms)`);
      console.log(`[API] ✅ Application started successfully!`);
      console.log(`[API] Health check endpoint: http://${host}:${port}/health`);
    });

    // Connection monitoring disabled to reduce log noise (see gateway service for reference)
    // httpServer.on('connection', (socket) => {
    //   console.log(`[API] Connection established: ${socket.remoteAddress}:${socket.remotePort}`);
    //   socket.on('close', () => {
    //     console.log(`[API] Connection closed: ${socket.remoteAddress}:${socket.remotePort}`);
    //   });
    // });

  } catch (error) {
    console.error(`[API] ❌ Bootstrap failed:`, error);
    if (error instanceof Error) {
      console.error(`[API] Error message: ${error.message}`);
      console.error(`[API] Stack trace: ${error.stack}`);
    }
    process.exit(1);
  }
}

console.log(`[API] Process started at ${new Date().toISOString()}`);
bootstrap();
