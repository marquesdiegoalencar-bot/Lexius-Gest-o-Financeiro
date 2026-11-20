import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { DreService } from './dre.service';
import { FiltroDreDto } from './dto/filtro-dre.dto';

@Controller('dre')
@UseGuards(PapelGuard)
export class DreController {
  constructor(private service: DreService) {}

  @Get('competencia')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  competencia(@Req() req: { empresaId: string }, @Query() filtros: FiltroDreDto) {
    return this.service.porCompetencia(req.empresaId, filtros);
  }

  @Get('caixa')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  caixa(@Req() req: { empresaId: string }, @Query() filtros: FiltroDreDto) {
    return this.service.porCaixa(req.empresaId, filtros);
  }
}