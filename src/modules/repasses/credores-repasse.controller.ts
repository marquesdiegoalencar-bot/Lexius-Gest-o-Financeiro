import { Controller, Get, Param, Put, Query, Req, UseGuards, Body } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { AtualizarRegraRepasseDto } from './dto/atualizar-regra-repasse.dto';
import { RepassesService } from './repasses.service';

type ReqAuth = { empresaId: string; user: { sub: string }; papel: PapelUsuario };

@Controller('credores')
@UseGuards(PapelGuard)
export class CredoresRepasseController {
  constructor(private service: RepassesService) {}

  @Get(':credorId/saldo-repasse')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  saldo(@Param('credorId') credorId: string, @Req() req: ReqAuth) {
    return this.service.saldoCredor(req.empresaId, credorId);
  }

  @Get(':credorId/baixas-pendentes-repasse')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
  )
  baixasPendentes(
    @Param('credorId') credorId: string,
    @Req() req: ReqAuth,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.service.baixasPendentes(req.empresaId, credorId, de, ate);
  }

  @Get(':credorId/regras-repasse')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  regra(@Param('credorId') credorId: string, @Req() req: ReqAuth) {
    return this.service.obterRegraRepasse(req.empresaId, credorId);
  }

  @Put(':credorId/regras-repasse')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  salvarRegra(
    @Param('credorId') credorId: string,
    @Req() req: ReqAuth,
    @Body() dto: AtualizarRegraRepasseDto,
  ) {
    return this.service.salvarRegraRepasse(req.empresaId, credorId, dto);
  }
}