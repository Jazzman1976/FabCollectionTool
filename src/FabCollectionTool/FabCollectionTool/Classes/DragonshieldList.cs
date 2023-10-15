namespace FabCollectionTool.Classes
{
    public class DragonshieldList
    {
        public List<DragonshieldDto> DragonshieldDtos { get; set; }

        public DragonshieldList(ImportResult importResult, string pSetName)
        {
            DragonshieldDtos = new List<DragonshieldDto>();
            foreach (DataDto dataDto
                in importResult.DataDtos
                    .Where(dto
                        => dto.Set == pSetName
                        || (dto.Id != null && dto.Id.StartsWith(pSetName.ToUpper()))))
            {
                // skip invalid dtos
                if (string.IsNullOrWhiteSpace(dataDto.Id) 
                    || dataDto.Id == "0" 
                    || dataDto.Id.Length < 3)
                {
                    continue;
                }

                // is true, if more than one pitch value is found (Red, Yellow, Blue)
                // if only one (e.g. Blue) than this is false.
                // Dragonshield must not have the pitchvalue in the TXT when it has only one!
                bool hasPitch = importResult.DataDtos
                    .Where(dto => dto.Name == dataDto.Name)
                    .DistinctBy(dto => dto.Pitch)
                    .Count() > 1;

                // get card name
                string? cardName = hasPitch
                        ? $"{dataDto.Name} ({dataDto.Pitch})"
                        : dataDto.Name;

                // get set code
                string? setCode = string.IsNullOrWhiteSpace(dataDto.Edition)
                    ? dataDto.Id[..3] // substring(0,3) new operator
                    : $"{dataDto.Id[..3]}-{dataDto.Edition.First()}";

                // get set name
                string? setName = string.IsNullOrWhiteSpace(dataDto.Edition)
                    ? dataDto.Set
                    : $"{dataDto.Set} {dataDto.Edition}";

                // get date
                string date = DateTime.Now.ToString("yyyy-MM-dd");

                // add collected standard printings
                if (dataDto.ST > 0) {
                    DragonshieldDto dto = new DragonshieldDto
                    {
                        FolderName = pSetName,
                        Quantity = dataDto.ST,
                        TradeQuantity = 0,
                        CardName = cardName,
                        SetCode = setCode,
                        SetName = setName,
                        CardNumber = dataDto.Id,
                        Condition = "NearMint",
                        Printing = "Normal",
                        Language = "English",
                        PriceBought = "0.0",
                        DateBought = date,
                    };
                    DragonshieldDtos.Add(dto);
                }

                // init with collected rainbow foil printings
                if (dataDto.RF > 0)
                {
                    DragonshieldDto dto = new DragonshieldDto
                    {
                        FolderName = pSetName,
                        Quantity = dataDto.RF,
                        TradeQuantity = 0,
                        CardName = cardName,
                        SetCode = setCode,
                        SetName = setName,
                        CardNumber = dataDto.Id,
                        Condition = "NearMint",
                        Printing = "Rainbow Foil",
                        Language = "English",
                        PriceBought = "0.0",
                        DateBought = date,
                    };
                    DragonshieldDtos.Add(dto);
                }

                // init with collected cold foil printings
                if (dataDto.CF > 0)
                {
                    DragonshieldDto dto = new DragonshieldDto
                    {
                        FolderName = pSetName,
                        Quantity = dataDto.CF,
                        TradeQuantity = 0,
                        CardName = cardName,
                        SetCode = setCode,
                        SetName = setName,
                        CardNumber = $"{dataDto.Id}-CF",
                        Condition = "NearMint",
                        //Printing = "",
                        Language = "English",
                        PriceBought = "0.0",
                        DateBought = date,
                    };
                    DragonshieldDtos.Add(dto);
                }

                // init with collected cold foil printings
                if (dataDto.GF > 0)
                {
                    DragonshieldDto dto = new DragonshieldDto
                    {
                        FolderName = pSetName,
                        Quantity = dataDto.GF,
                        TradeQuantity = 0,
                        CardName = cardName,
                        SetCode = setCode,
                        SetName = setName,
                        CardNumber = $"{dataDto.Id}-GF",
                        Condition = "NearMint",
                        //Printing = "",
                        Language = "English",
                        PriceBought = "0.0",
                        DateBought = date,
                    };
                    DragonshieldDtos.Add(dto);
                }
            }
        }
    }
}
