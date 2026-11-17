import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CobRetornoService } from './cob-retorno.service';

type ReqAuth = { empresaId: string };

@Controller('integracao/cobranca/retorno')
@UseGuards(PapelGuard)
export class CobRetornoController {
  constructor(private retorno: CobRetornoService) {}

  @Get('falhas')
  @RequirePapeis(PapelUsuario.MASTER)
  listarFalhas(@Req() req: ReqAuth, @Query('limit') limit?: string) {
    const take = limit ? Math.min(Number(limit) || 100, 500) : 100;
    return this.retorno.listarFalhas(req.empresaId, take);
  }

  @Post('eventos/:id/reenviar')
  @RequirePapeis(PapelUsuario.MASTER)
  reenviar(@Param('id') id: string, @Req() req: ReqAuth) {
    return this.retorno.reenviarManual(id, req.empresaId);
  }
}