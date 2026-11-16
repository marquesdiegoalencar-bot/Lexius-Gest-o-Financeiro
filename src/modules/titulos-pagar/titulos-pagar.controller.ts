import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CreateTituloPagarDto } from './dto/create-titulo-pagar.dto';
import { FiltroTituloPagarDto } from './dto/filtro-titulo-pagar.dto';
import { RejeitarTituloPagarDto } from './dto/rejeitar-titulo-pagar.dto';
import { TitulosPagarService } from './titulos-pagar.service';

type ReqAuth = { empresaId: string; user: { sub: string } };

@Controller('titulos-pagar')
@UseGuards(PapelGuard)
export class TitulosPagarController {
  constructor(private service: TitulosPagarService) {}

  @Get()
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  list(@Req() req: ReqAuth, @Query() filtros: FiltroTituloPagarDto) {
    return this.service.list(req.empresaId, filtros);
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
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
  )
  create(@Req() req: ReqAuth, @Body() dto: CreateTituloPagarDto) {
    return this.service.create(req.empresaId, req.user.sub, dto);
  }

  @Post(':id/aprovar')
  @RequirePapeis(PapelUsuario.MASTER)
  aprovar(@Param('id') id: string, @Req() req: ReqAuth) {
    return this.service.aprovar(id, req.empresaId, req.user.sub);
  }

  @Post(':id/rejeitar')
  @RequirePapeis(PapelUsuario.MASTER)
  rejeitar(@Param('id') id: string, @Req() req: ReqAuth, @Body() dto: RejeitarTituloPagarDto) {
    return this.service.rejeitar(id, req.empresaId, req.user.sub, dto);
  }
}