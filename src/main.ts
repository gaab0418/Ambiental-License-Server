import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import {
	FastifyAdapter,
	NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		new FastifyAdapter(),
		{ logger: ['error', 'warn', 'log', 'debug', 'verbose'] },
	);

	const configService = app.get(ConfigService);

	const config = new DocumentBuilder()
		.setTitle('Ambiental API - Core License Server')
		.setDescription('Ambiental API - Core License Server')
		.setVersion('1.0')
		.addBearerAuth(
			{
				type: 'http',
				scheme: 'bearer',
				bearerFormat: 'JWT',
				name: 'Authorization',
				description: 'Insira o token JWT manualmente',
				in: 'header',
			},
			'JWT-auth',
		)
		.addOAuth2(
			{
				type: 'oauth2',
				flows: {
					password: {
						tokenUrl: '/auth/swagger-login',
						scopes: {},
					},
				},
				description: 'Login com email e senha',
			},
			'OAuth2-login',
		)
		.build();

	const nodeEnv = configService.get<string>('NODE_ENV', 'development');

	if (nodeEnv !== 'production') {
		app.enableCors();
	} else {
		const allowedOrigins =
			configService.get<string>('ALLOWED_ORIGINS')?.split(',') || [];
		app.enableCors({
			origin: allowedOrigins,
			methods: 'GET,POST',
			credentials: true,
		});
	}

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);

	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('docs', app, document, {
		jsonDocumentUrl: 'docs/json',
		swaggerOptions: {
			url: 'docs/json',
		},
	});

	const port = configService.get<number>('SERVER_PORT', 3000);
	await app.listen(port, '0.0.0.0');
}
bootstrap();
