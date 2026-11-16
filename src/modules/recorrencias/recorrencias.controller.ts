import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CreateRecorrenciaDto } from './dto/create-recorrencia.dto';
import { RecorrenciasService } from './recorrencias.service';

type ReqAuth = { empresaId: string; user: { sub: string } };

@Controller('recorrencias')
@UseGuards(PapelGuard)
export class RecorrenciasController {
  constructor(private service: RecorrenciasService) {}

  @Get()
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  list(@Req() req: ReqAuth) {
    return this.service.list(req.empresaId);
  }

  @Get(':id')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  get(@Param('id') id: string, @Req() req: ReqAuth) {
    return this.service.findOne(id, req.empresaId);
  }

  @Post()
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  create(@Req() req: ReqAuth, @Body() dto: CreateRecorrenciaDto) {
    return this.service.create(req.empresaId, dto);
  }

  @Post(':id/gerar')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  gerar(@Param('id') id: string, @Req() req: ReqAuth) {
    return this.service.gerar(id, req.empresaId, req.user.sub);
  }
}