import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { BaixasService } from './baixas.service';
import { BaixarTituloDto } from './dto/baixar-titulo.dto';
import { EstornarBaixaDto } from './dto/estornar-baixa.dto';

type ReqAuth = {
  empresaId: string;
  user: { sub: string };
  papel: PapelUsuario;
};

@Controller()
@UseGuards(PapelGuard)
export class BaixasController {
  constructor(private service: BaixasService) {}

  @Post('titulos-receber/:id/baixar')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
  )
  baixarReceber(@Param('id') id: string, @Req() req: ReqAuth, @Body() dto: BaixarTituloDto) {
    return this.service.baixarTituloReceber(id, req.empresaId, req.user.sub, dto);
  }

  @Post('titulos-pagar/:id/baixar')
  @RequirePapeis(PapelUsuario.MASTER)
  baixarPagar(@Param('id') id: string, @Req() req: ReqAuth, @Body() dto: BaixarTituloDto) {
    return this.service.baixarTituloPagar(id, req.empresaId, req.user.sub, req.papel, dto);
  }

  @Post('baixas/:id/estornar')
  @RequirePapeis(PapelUsuario.MASTER)
  estornar(@Param('id') id: string, @Req() req: ReqAuth, @Body() dto: EstornarBaixaDto) {
    return this.service.estornar(id, req.empresaId, req.user.sub, req.papel, dto);
  }
}