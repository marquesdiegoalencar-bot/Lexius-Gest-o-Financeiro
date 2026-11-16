import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { EmpresasService } from './empresas.service';

@Controller('empresas')
export class EmpresasController {
  constructor(private service: EmpresasService) {}

  @Get()
  list() {
    return this.service.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(PapelGuard)
  @RequirePapeis(PapelUsuario.MASTER)
  create(@Body() dto: CreateEmpresaDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(PapelGuard)
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateEmpresaDto) {
    return this.service.update(id, dto);
  }
}