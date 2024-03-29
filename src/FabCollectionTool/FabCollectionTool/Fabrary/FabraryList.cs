﻿using FabCollectionTool.Classes;
using FabCollectionTool.Extensions;

namespace FabCollectionTool.Fabrary
{
    public class FabraryList
    {
        public List<FabraryDto> FabraryDtos { get; set; }

        public FabraryList(ImportResult importResult)
        {
            FabraryDtos = new List<FabraryDto>();
            foreach (DataDto dataDto in importResult.DataDtos)
            {
                // skip invalid dtos
                if (string.IsNullOrWhiteSpace(dataDto.Id) || dataDto.Id == "0")
                {
                    continue;
                }

                // add or update card variants
                FabraryDtos.AddOrUpdate(dataDto, FabraryConstants.Foiling.STANDARD);
                FabraryDtos.AddOrUpdate(dataDto, FabraryConstants.Foiling.RAINBOW);
                FabraryDtos.AddOrUpdate(dataDto, FabraryConstants.Foiling.COLD);
                FabraryDtos.AddOrUpdate(dataDto, FabraryConstants.Foiling.GOLD);
            }
        }
    }
}
