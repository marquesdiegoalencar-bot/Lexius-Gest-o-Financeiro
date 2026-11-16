import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CentrosCustoService } from './centros-custo.service';
import { CreateCentroCustoDto } from './dto/create-centro-custo.dto';

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
  list(@Req() req: { empresaId: string }) {
    return this.service.list(req.empresaId);
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
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  create(@Req() req: { empresaId: string }, @Body() dto: CreateCentroCustoDto) {
    return this.service.create(req.empresaId, dto);
  }
}