import { Module } from '@nestjs/common';
import { CentrosCustoModule } from '../../modules/centros-custo/centros-custo.module';
import { DepartamentosModule } from '../../modules/departamentos/departamentos.module';
import { FinanceiroDimensoesService } from './financeiro-dimensoes.service';

@Module({
  imports: [CentrosCustoModule, DepartamentosModule],
  providers: [FinanceiroDimensoesService],
  exports: [FinanceiroDimensoesService],
})
export class FinanceiroDimensoesModule {}