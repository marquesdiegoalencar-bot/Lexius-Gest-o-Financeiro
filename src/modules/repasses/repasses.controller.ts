import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { FiltroRepasseDto } from './dto/filtro-repasse.dto';
import { GerarRepasseDto } from './dto/gerar-repasse.dto';
import { RepassesService } from './repasses.service';

type ReqAuth = { empresaId: string; user: { sub: string } };

@Controller('repasses')
@UseGuards(PapelGuard)
export class RepassesController {
  constructor(private service: RepassesService) {}

  @Get()
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  list(@Req() req: ReqAuth, @Query() filtros: FiltroRepasseDto) {
    return this.service.listar(req.empresaId, filtros);
  }

  @Get(':id')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  obter(@Param('id') id: string, @Req() req: ReqAuth) {
    return this.service.obter(req.empresaId, id);
  }

  @Post('gerar')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  gerar(@Req() req: ReqAuth, @Body() dto: GerarRepasseDto) {
    return this.service.gerar(req.empresaId, req.user.sub, dto);
  }

  @Post(':id/calcular')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  calcular(@Param('id') id: string, @Req() req: ReqAuth) {
    return this.service.calcular(req.empresaId, id);
  }
}