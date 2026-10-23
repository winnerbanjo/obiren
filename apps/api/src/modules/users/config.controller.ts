import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { getConfigOptions } from './config-options';

@ApiTags('Configuration')
@Controller('config')
export class ConfigController {
  @Get('options')
  @ApiOperation({
    summary: 'Get mobile enum and localization options',
    description: 'Returns versioned UI option values. Condition and consultation choices are provisional and must be confirmed by product/clinical review.',
  })
  @ApiResponse({ status: 200, description: 'Versioned mobile configuration option catalog.' })
  getOptions() {
    return {
      success: true,
      data: getConfigOptions(),
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
