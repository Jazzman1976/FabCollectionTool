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
                FabraryDtos.SetExtrasForTrade(dataDto, importResult);
            }
        }
    }
}
