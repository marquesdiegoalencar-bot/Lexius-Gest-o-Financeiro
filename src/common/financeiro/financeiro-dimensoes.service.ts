import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CentrosCustoService } from '../../modules/centros-custo/centros-custo.service';
import { DepartamentosService } from '../../modules/departamentos/departamentos.service';

/** Valida departamento/centro em novos vínculos — ordem fixa de lock (departamento → centro). */
@Injectable()
export class FinanceiroDimensoesService {
  constructor(
    private centrosCusto: CentrosCustoService,
    private departamentos: DepartamentosService,
  ) {}

  precisaTransacao(dims: { centro_custo_id?: string | null; departamento_id?: string | null }): boolean {
    return !!(dims.centro_custo_id || dims.departamento_id);
  }

  async assertNovosVinculosTx(
    manager: EntityManager,
    empresaId: string,
    dims: { centro_custo_id?: string | null; departamento_id?: string | null },
  ): Promise<void> {
    if (dims.departamento_id) {
      await this.departamentos.assertVinculoFinanceiroTx(manager, empresaId, dims.departamento_id);
    }
    if (dims.centro_custo_id) {
      await this.centrosCusto.assertVinculoFinanceiroTx(manager, empresaId, dims.centro_custo_id);
    }
  }
}