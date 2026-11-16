import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CreateTituloReceberDto } from './dto/create-titulo-receber.dto';
import { FiltroTituloReceberDto } from './dto/filtro-titulo-receber.dto';
import { ParcelarTituloReceberDto } from './dto/parcelar-titulo-receber.dto';
import { CobrancasService } from '../cobrancas/cobrancas.service';
import { TitulosReceberService } from './titulos-receber.service';

type ReqAuth = { empresaId: string; user: { sub: string } };

@Controller('titulos-receber')
@UseGuards(PapelGuard)
export class TitulosReceberController {
  constructor(
    private service: TitulosReceberService,
    private cobrancas: CobrancasService,
  ) {}

  @Get()
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  list(@Req() req: ReqAuth, @Query() filtros: FiltroTituloReceberDto) {
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
  create(@Req() req: ReqAuth, @Body() dto: CreateTituloReceberDto) {
    return this.service.createManual(req.empresaId, req.user.sub, dto);
  }

  @Post('parcelar')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
  )
  parcelar(@Req() req: ReqAuth, @Body() dto: ParcelarTituloReceberDto) {
    return this.service.parcelar(req.empresaId, req.user.sub, dto);
  }

  @Patch(':id/cancelar')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  cancelar(@Param('id') id: string, @Req() req: ReqAuth) {
    return this.service.cancelar(id, req.empresaId, req.user.sub);
  }

  @Post(':id/emitir-boleto')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
  )
  emitirBoleto(
    @Param('id') id: string,
    @Req() req: ReqAuth,
    @Body() body?: { conta_bancaria_id?: string },
  ) {
    return this.cobrancas.emitirBoletoTitulo(id, req.empresaId, body?.conta_bancaria_id);
  }

  @Post(':id/emitir-pix-cobv')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
  )
  emitirPixCobv(
    @Param('id') id: string,
    @Req() req: ReqAuth,
    @Body() body?: { conta_bancaria_id?: string },
  ) {
    return this.cobrancas.emitirPixCobvTitulo(id, req.empresaId, body?.conta_bancaria_id);
  }

  @Post(':id/reemitir-pix-cobv')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  reemitirPixCobv(
    @Param('id') id: string,
    @Req() req: ReqAuth,
    @Body() body?: { conta_bancaria_id?: string },
  ) {
    return this.cobrancas.reemitirPixCobvTitulo(id, req.empresaId, body?.conta_bancaria_id);
  }
}