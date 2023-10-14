namespace FabCollectionTool.Classes
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

                // always add ST variant, even if zero (to show missing cards in Fabrary)
                FabraryDtos.Add(new(dataDto)
                {
                    Foiling = null,
                    Have = dataDto.ST
                });

                if (dataDto.RF > 0)
                {
                    FabraryDto fabDto = new(dataDto)
                    {
                        Foiling = "Rainbow",
                        Have = dataDto.RF
                    };
                    FabraryDtos.Add(fabDto);
                }

                if (dataDto.CF > 0)
                {
                    FabraryDto fabDto = new(dataDto)
                    {
                        Foiling = "Cold",
                        Have = dataDto.CF
                    };
                    FabraryDtos.Add(fabDto);
                }

                if (dataDto.GF > 0)
                {
                    FabraryDto fabDto = new(dataDto)
                    {
                        Foiling = "Gold",
                        Have = dataDto.GF
                    };
                    FabraryDtos.Add(fabDto);
                }
            }
        }
    }
}
