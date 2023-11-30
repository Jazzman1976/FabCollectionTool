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

                //INFO: always add, even zero, to show missing cards in Fabrary

                FabraryDtos.Add(new(dataDto)
                {
                    Foiling = null,
                    Have = dataDto.ST
                });

                FabraryDtos.Add(new(dataDto)
                {
                    Foiling = "Rainbow",
                    Have = dataDto.RF
                });

                FabraryDtos.Add(new(dataDto)
                {
                    Foiling = "Cold",
                    Have = dataDto.CF
                });

                FabraryDtos.Add(new(dataDto)
                {
                    Foiling = "Gold",
                    Have = dataDto.GF
                });
            }
        }
    }
}
