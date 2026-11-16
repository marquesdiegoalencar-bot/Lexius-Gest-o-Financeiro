import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PapelGuard } from '../../common/guards/papel.guard';
import { UsuarioEmpresa } from '../../database/entities/usuario-empresa.entity';
import { Usuario } from '../../database/entities/usuario.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, UsuarioEmpresa]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        const expiresIn = config.get<string>('JWT_EXPIRES_IN') ?? '8h';
        return {
          secret,
          signOptions: { expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}` },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PapelGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, PapelGuard, JwtModule, TypeOrmModule],
})
export class AuthModule {}