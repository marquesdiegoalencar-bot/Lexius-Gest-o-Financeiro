import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Empresa } from '../../database/entities/empresa.entity';
import { UsuarioEmpresa } from '../../database/entities/usuario-empresa.entity';
import { EmpresasController } from './empresas.controller';
import { EmpresasService } from './empresas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Empresa, UsuarioEmpresa]), AuthModule],
  controllers: [EmpresasController],
  providers: [EmpresasService],
  exports: [EmpresasService],
})
export class EmpresasModule {}