import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsuarioEmpresa } from '../../database/entities/usuario-empresa.entity';
import { Usuario } from '../../database/entities/usuario.entity';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, UsuarioEmpresa]), AuthModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}