import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CreateDepartamentoDto } from './dto/create-departamento.dto';
import { FiltroDepartamentoDto } from './dto/filtro-departamento.dto';
import { UpdateDepartamentoDto } from './dto/update-departamento.dto';
import { DepartamentosService } from './departamentos.service';

@Controller('departamentos')
@UseGuards(PapelGuard)
export class DepartamentosController {
  constructor(private service: DepartamentosService) {}

  @Get()
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  list(
    @Req() req: { empresaId: string },
    @Query() filtros: FiltroDepartamentoDto,
    @Query('ativo') ativoQuery?: string,
  ) {
    if (ativoQuery === 'true') filtros.ativo = true;
    else if (ativoQuery === 'false') filtros.ativo = false;
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
  create(@Req() req: { empresaId: string }, @Body() dto: CreateDepartamentoDto) {
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
    @Body() dto: UpdateDepartamentoDto,
  ) {
    return this.service.update(id, req.empresaId, dto);
  }
}