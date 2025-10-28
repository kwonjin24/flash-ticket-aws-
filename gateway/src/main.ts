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
    console.log(`[Gateway] Starting bootstrap process...`);
    console.log(`[Gateway] NODE_ENV: ${process.env.NODE_ENV ?? 'not set'}`);
    console.log(`[Gateway] QUEUE_GATEWAY_PORT: ${process.env.QUEUE_GATEWAY_PORT ?? 'not set'}`);
    console.log(`[Gateway] PORT: ${process.env.PORT ?? 'not set'}`);

    console.log(`[Gateway] Creating NestFactory application...`);
    const app = await NestFactory.create(AppModule);
    console.log(`[Gateway] ✅ NestFactory application created`);

    console.log(`[Gateway] Configuring CORS...`);
    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          if (origin) {
            console.log(`[Gateway CORS] Allowed origin: ${origin}`);
          }
          callback(null, true);
          return;
        }
        console.warn(`[Gateway CORS] Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    });
    console.log(`[Gateway] ✅ CORS enabled`);

    console.log(`[Gateway] Setting up global validation pipes...`);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    console.log(`[Gateway] ✅ Validation pipes configured`);

    console.log(`[Gateway] Initializing application modules...`);
    const initStartTime = Date.now();
    await app.init();
    console.log(`[Gateway] ✅ Application modules initialized (${Date.now() - initStartTime}ms)`);

    const port = Number(process.env.QUEUE_GATEWAY_PORT ?? process.env.PORT ?? 3000);
    const host = '0.0.0.0';

    console.log(`[Gateway] Getting HTTP server instance...`);
    const server = app.getHttpServer();
    console.log(`[Gateway] ✅ HTTP server instance obtained`);

    // Set up error handlers
    console.log(`[Gateway] Setting up error handlers...`);
    server.on('error', (error: any) => {
      console.error(`[Gateway] ❌ Server error: ${error.message}`, error.stack);
      process.exit(1);
    });

    server.on('clientError', (error: any) => {
      console.error(`[Gateway] ⚠️ Client error: ${error.message}`);
    });

    console.log(`[Gateway] 🚀 Starting to listen on ${host}:${port}...`);
    const listenStartTime = Date.now();

    // Use the modern listen API with all parameters
    const httpServer = server.listen(port, host, () => {
      const listenTime = Date.now() - listenStartTime;
      console.log(`[Gateway] ✅ HTTP server listening on ${host}:${port} (${listenTime}ms)`);
      console.log(`[Gateway] ✅ Application started successfully!`);
      console.log(`[Gateway] Health check endpoint: http://${host}:${port}/queue/healthz`);
    });

    // Connection monitoring disabled to reduce log noise
    // httpServer.on('connection', (socket) => {
    //   console.log(`[Gateway] Connection established: ${socket.remoteAddress}:${socket.remotePort}`);
    //   socket.on('close', () => {
    //     console.log(`[Gateway] Connection closed: ${socket.remoteAddress}:${socket.remotePort}`);
    //   });
    // });

  } catch (error) {
    console.error(`[Gateway] ❌ Bootstrap failed:`, error);
    if (error instanceof Error) {
      console.error(`[Gateway] Error message: ${error.message}`);
      console.error(`[Gateway] Stack trace: ${error.stack}`);
    }
    process.exit(1);
  }
}

console.log(`[Gateway] Process started at ${new Date().toISOString()}`);
bootstrap();
