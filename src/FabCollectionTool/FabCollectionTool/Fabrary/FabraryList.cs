using FabCollectionTool.Classes;
using FabCollectionTool.Extensions;

namespace FabCollectionTool.Fabrary
{
    public class FabraryList
    {
        public List<FabraryDto> FabraryDtos { get; set; }

        public FabraryList(ImportResult importResult)
        {
            FabraryDtos = new List<FabraryDto>();

            // iterate all to add or update list for csv generation
            foreach (DataDto dataDto in importResult.DataDtos)
            {
                // skip invalid dtos
                if (string.IsNullOrWhiteSpace(dataDto.Id) || dataDto.Id == "0")
                {
                    continue;
                }

                // add or update card variants
                // in fab every foiling has a new row
                // add row by row depending on foiling
                FabraryDtos.AddOrUpdate(dataDto);
            }

            // iterate all again to add info after all cards have been added to list
            foreach (DataDto dataDto in importResult.DataDtos)
            {
                // skip invalid dtos
                if (string.IsNullOrWhiteSpace(dataDto.Id) || dataDto.Id == "0")
                {
                    continue;
                }

                FabraryDtos.SetExtrasForTrade(dataDto, importResult);
            }

            // iterate all again to fix info after all cards have been added to list
            foreach (DataDto dataDto in importResult.DataDtos)
            {
                // skip invalid dtos
                if (string.IsNullOrWhiteSpace(dataDto.Id) || dataDto.Id == "0")
                {
                    continue;
                }

                FabraryDtos.FixExceptions(dataDto);
            }
        }
    }
}
