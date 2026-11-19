import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CentrosCustoService } from './centros-custo.service';
import { TipoCentroCusto } from '../../database/enums';
import { CreateCentroCustoDto } from './dto/create-centro-custo.dto';
import { UpdateCentroCustoDto } from './dto/update-centro-custo.dto';

@Controller('centros-custo')
@UseGuards(PapelGuard)
export class CentrosCustoController {
  constructor(private service: CentrosCustoService) {}

  @Get()
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  list(@Req() req: { empresaId: string }, @Query('tipo') tipo?: TipoCentroCusto) {
    return this.service.list(req.empresaId, tipo);
  }

  @Get('arvore')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  arvore(@Req() req: { empresaId: string }, @Query('tipo') tipo?: TipoCentroCusto) {
    return this.service.listArvore(req.empresaId, tipo);
  }

  @Get(':id')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  get(@Param('id') id: string, @Req() req: { empresaId: string }) {
    return this.service.findOne(id, req.empresaId);
  }

  @Post()
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
  )
  create(@Req() req: { empresaId: string }, @Body() dto: CreateCentroCustoDto) {
    return this.service.create(req.empresaId, dto);
  }

  @Patch(':id')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
  )
  update(
    @Param('id') id: string,
    @Req() req: { empresaId: string },
    @Body() dto: UpdateCentroCustoDto,
  ) {
    return this.service.update(id, req.empresaId, dto);
  }
}