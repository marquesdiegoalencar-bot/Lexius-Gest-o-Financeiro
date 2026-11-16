import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { RelatoriosService } from './relatorios.service';

type ReqAuth = { empresaId: string };

@Controller('relatorios')
@UseGuards(PapelGuard)
export class RelatoriosController {
  constructor(private service: RelatoriosService) {}

  @Get('titulos-receber')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  titulosReceber(@Req() req: ReqAuth, @Query('de') de: string, @Query('ate') ate: string) {
    return this.service.relatorioTitulosReceber(req.empresaId, de, ate);
  }

  @Get('titulos-pagar')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  titulosPagar(@Req() req: ReqAuth, @Query('de') de: string, @Query('ate') ate: string) {
    return this.service.relatorioTitulosPagar(req.empresaId, de, ate);
  }

  @Get('vencidos')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  vencidos(@Req() req: ReqAuth) {
    return this.service.vencidos(req.empresaId);
  }
}