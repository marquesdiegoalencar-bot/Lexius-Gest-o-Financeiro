import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CreateOrcamentoVersaoDto } from './dto/create-orcamento-versao.dto';
import { SalvarOrcamentoItensDto } from './dto/salvar-orcamento-itens.dto';
import { OrcamentoService } from './orcamento.service';

@Controller('orcamento')
@UseGuards(PapelGuard)
export class OrcamentoController {
  constructor(private service: OrcamentoService) {}

  @Get('versoes')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  list(
    @Req() req: { empresaId: string },
    @Query('ano') ano?: string,
    @Query('mes') mes?: string,
  ) {
    return this.service.listVersoes(
      req.empresaId,
      ano ? Number(ano) : undefined,
      mes ? Number(mes) : undefined,
    );
  }

  @Post('versoes')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  criar(@Req() req: { empresaId: string }, @Body() dto: CreateOrcamentoVersaoDto) {
    return this.service.criarVersao(req.empresaId, dto);
  }

  @Get('versoes/:versaoId')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  obter(@Param('versaoId') versaoId: string, @Req() req: { empresaId: string }) {
    return this.service.obterVersao(versaoId, req.empresaId);
  }

  @Post('versoes/:versaoId/itens')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  salvarItens(
    @Param('versaoId') versaoId: string,
    @Req() req: { empresaId: string },
    @Body() dto: SalvarOrcamentoItensDto,
  ) {
    return this.service.salvarItensFolha(versaoId, req.empresaId, dto);
  }

  @Patch('versoes/:versaoId/cancelar')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  cancelar(@Param('versaoId') versaoId: string, @Req() req: { empresaId: string }) {
    return this.service.cancelarVersao(versaoId, req.empresaId);
  }

  @Patch('versoes/:versaoId/aprovar')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  aprovar(@Param('versaoId') versaoId: string, @Req() req: { empresaId: string }) {
    return this.service.aprovarVersao(versaoId, req.empresaId);
  }

  @Patch('versoes/:versaoId/fechar')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  fechar(@Param('versaoId') versaoId: string, @Req() req: { empresaId: string }) {
    return this.service.fecharVersao(versaoId, req.empresaId);
  }

  @Get('versoes/:versaoId/realizado-vs-previsto')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  comparativo(@Param('versaoId') versaoId: string, @Req() req: { empresaId: string }) {
    return this.service.realizadoVsPrevisto(versaoId, req.empresaId);
  }
}