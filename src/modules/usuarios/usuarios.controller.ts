import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
@UseGuards(PapelGuard)
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  @Get()
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO, PapelUsuario.CONSULTA)
  list(@Req() req: { empresaId: string }) {
    return this.service.listByEmpresa(req.empresaId);
  }

  @Post()
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN)
  create(@Body() dto: CreateUsuarioDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUsuarioDto, @Req() req: { empresaId: string }) {
    return this.service.update(id, req.empresaId, dto);
  }
}